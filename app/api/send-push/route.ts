import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import * as http2 from "http2";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";

/**
 * APNs Push Notification Endpoint
 *
 * Sends push notifications to all registered devices via Apple Push Notification
 * service (APNs). Device tokens stored in PostgreSQL (device_tokens table).
 */

// Request body validation
const RequestBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  task_id: z.string().optional(),
  priority: z.string().optional(),
  badge: z.number().optional().default(1),
  sound: z.string().optional().default("default"),
});

// APNs configuration
const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_TOPIC = process.env.APNS_TOPIC || "com.tomos.app";
const APNS_ENVIRONMENT = process.env.APNS_ENVIRONMENT || "development";
const APNS_HOST = APNS_ENVIRONMENT === "production"
  ? "api.push.apple.com"
  : "api.sandbox.push.apple.com";

// Cache for APNs auth token (valid 1 hour, refresh at 50 mins)
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Reads the APNs .p8 private key.
 */
function getAPNsPrivateKey(): string {
  if (process.env.APNS_AUTH_KEY_BASE64) {
    return Buffer.from(process.env.APNS_AUTH_KEY_BASE64, 'base64').toString('utf8');
  }
  if (process.env.APNS_AUTH_KEY) {
    let key = process.env.APNS_AUTH_KEY;
    key = key.split('\\n').join('\n');
    key = key.split('\\\\n').join('\n');
    return key;
  }
  const keyPath = process.env.APNS_AUTH_KEY_PATH || "./AuthKey_TomOS_APNs.p8";
  const absolutePath = path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`APNs key file not found: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

/**
 * Generates a JWT token for APNs authentication.
 */
function getAPNsToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiry > now + 600) {
    return cachedToken.token;
  }
  if (!APNS_KEY_ID || !APNS_TEAM_ID) {
    throw new Error("APNS_KEY_ID and APNS_TEAM_ID must be configured");
  }
  const privateKey = getAPNsPrivateKey();
  const token = jwt.sign(
    { iss: APNS_TEAM_ID, iat: now },
    privateKey,
    { algorithm: "ES256", keyid: APNS_KEY_ID }
  );
  cachedToken = { token, expiry: now + 3000 };
  return token;
}

/**
 * Sends a push notification to a single device via APNs HTTP/2.
 */
async function sendToDevice(
  deviceToken: string,
  payload: object
): Promise<{ success: boolean; error?: string; status?: number }> {
  return new Promise((resolve) => {
    try {
      const token = getAPNsToken();
      const payloadString = JSON.stringify(payload);
      const client = http2.connect(`https://${APNS_HOST}`);

      client.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      const headers = {
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        "authorization": `bearer ${token}`,
        "apns-topic": APNS_TOPIC,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payloadString),
      };

      const req = client.request(headers);
      let responseData = "";
      let responseStatus = 0;

      req.on("response", (headers) => {
        responseStatus = headers[":status"] as number;
        if (responseStatus === 200) {
          resolve({ success: true, status: 200 });
        }
      });

      req.on("data", (chunk) => { responseData += chunk; });

      req.on("end", () => {
        client.close();
        if (responseData) {
          try {
            const response = JSON.parse(responseData);
            if (response.reason) {
              resolve({ success: false, error: response.reason, status: responseStatus });
            }
          } catch { /* ignore parse errors */ }
        }
        if (responseStatus === 410) {
          resolve({ success: false, error: "DeviceTokenNotForTopic", status: 410 });
        }
      });

      req.on("error", (err) => {
        client.close();
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(10000, () => {
        req.close();
        client.close();
        resolve({ success: false, error: "Request timeout" });
      });

      req.write(payloadString);
      req.end();
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

/**
 * Deactivates a device token in Postgres.
 * Called when APNs returns 410 (device unregistered).
 */
async function deactivateDevice(deviceToken: string): Promise<void> {
  try {
    await prisma.deviceToken.updateMany({
      where: { token: deviceToken },
      data: { active: false },
    });
  } catch (error) {
    console.error(`Failed to deactivate device:`, error);
  }
}

/**
 * Fetches all active device tokens from Postgres.
 */
async function getActiveDevices(): Promise<Array<{ token: string; platform: string }>> {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { active: true },
      select: { token: true, platform: true },
    });
    console.log(`Found ${devices.length} active devices`);
    return devices;
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, body, task_id, priority, badge, sound } = parsed.data;

    // Validate APNs configuration
    if (!APNS_KEY_ID || !APNS_TEAM_ID) {
      return NextResponse.json(
        { success: false, error: "APNs credentials not configured" },
        { status: 500 }
      );
    }

    // Get all active devices from Postgres
    const devices = await getActiveDevices();

    if (devices.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active devices to notify",
        sent_to: 0,
        devices: [],
        errors: [],
      });
    }

    // Build APNs payload
    const payload = {
      aps: {
        alert: { title, body },
        sound,
        badge,
        "category": "TASK_NOTIFICATION",
        "mutable-content": 1,
      },
      task_id,
      priority,
      type: "task_notification",
      timestamp: new Date().toISOString(),
    };

    // Send to all devices
    const successfulDevices: string[] = [];
    const errors: Array<{ device: string; error: string }> = [];
    const devicesToDeactivate: string[] = [];

    for (const device of devices) {
      const result = await sendToDevice(device.token, payload);

      if (result.success) {
        successfulDevices.push(device.token.substring(0, 16) + `... (${device.platform})`);
      } else {
        errors.push({
          device: device.token.substring(0, 16) + "...",
          error: result.error || "Unknown error",
        });
        if (result.status === 410) {
          devicesToDeactivate.push(device.token);
        }
      }
    }

    // Deactivate unregistered devices (fire-and-forget)
    for (const token of devicesToDeactivate) {
      deactivateDevice(token).catch(() => {});
    }

    const successCount = successfulDevices.length;
    return NextResponse.json({
      success: successCount > 0,
      message: `Push notification sent to ${successCount} device(s)`,
      sent_to: successCount,
      devices: successfulDevices,
      errors,
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send push notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/debugging
export async function GET() {
  const config = {
    APNS_KEY_ID: APNS_KEY_ID ? "configured" : "missing",
    APNS_TEAM_ID: APNS_TEAM_ID ? "configured" : "missing",
    APNS_TOPIC,
    APNS_ENVIRONMENT,
    APNS_HOST,
    DATABASE: "PostgreSQL (device_tokens table)",
  };

  return NextResponse.json({
    endpoint: "/api/send-push",
    method: "POST",
    description: "Send push notification to all registered devices via APNs",
    configuration: config,
    body: {
      title: "string (required)",
      body: "string (required)",
      task_id: "string (optional)",
      priority: "string (optional)",
      badge: "number (optional, default: 1)",
      sound: "string (optional, default: 'default')",
    },
  });
}
