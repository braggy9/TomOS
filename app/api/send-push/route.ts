import { NextResponse } from "next/server";
import { z } from "zod";
import { Client } from "@notionhq/client";
import * as http2 from "http2";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";

/**
 * APNs Push Notification Endpoint
 *
 * This endpoint sends push notifications to all registered iOS/macOS devices
 * via Apple Push Notification service (APNs).
 *
 * APNs Authentication Flow (Token-based):
 * 1. Load the .p8 private key file
 * 2. Generate a JWT token signed with the key
 * 3. Connect to APNs via HTTP/2
 * 4. Send notification with JWT in Authorization header
 *
 * APNs Servers:
 * - Development/Sandbox: api.sandbox.push.apple.com:443
 * - Production: api.push.apple.com:443
 *
 * We use HTTP/2 directly instead of the deprecated node-apn package
 * for better reliability and modern Node.js compatibility.
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

// APNs configuration from environment
const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_TOPIC = process.env.APNS_TOPIC || "com.tomos.app";
const APNS_ENVIRONMENT = process.env.APNS_ENVIRONMENT || "development";

// APNs server URLs
const APNS_HOST = APNS_ENVIRONMENT === "production"
  ? "api.push.apple.com"
  : "api.sandbox.push.apple.com";

// Device tokens database ID (should match register-device)
const DEVICE_TOKENS_DATABASE_ID = process.env.NOTION_DEVICE_TOKENS_DB_ID;

// Cache for the APNs auth token (valid for 1 hour, we refresh at 50 mins)
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Reads the APNs .p8 private key file.
 * The key should be stored securely and not committed to version control.
 */
function getAPNsPrivateKey(): string {
  // Try environment variable first (recommended for Vercel)
  if (process.env.APNS_AUTH_KEY) {
    console.log("🔑 Using APNs key from environment variable");
    return process.env.APNS_AUTH_KEY;
  }

  // Fall back to file path
  const keyPath = process.env.APNS_AUTH_KEY_PATH || "./AuthKey_TomOS_APNs.p8";
  const absolutePath = path.resolve(process.cwd(), keyPath);

  console.log("🔑 Loading APNs key from:", absolutePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`APNs key file not found: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

/**
 * Generates a JWT token for APNs authentication.
 * Token is valid for 1 hour but we cache it for 50 minutes.
 */
function getAPNsToken(): string {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 10 minute buffer)
  if (cachedToken && cachedToken.expiry > now + 600) {
    console.log("🔐 Using cached APNs token");
    return cachedToken.token;
  }

  console.log("🔐 Generating new APNs token");

  if (!APNS_KEY_ID || !APNS_TEAM_ID) {
    throw new Error("APNS_KEY_ID and APNS_TEAM_ID must be configured");
  }

  const privateKey = getAPNsPrivateKey();

  const token = jwt.sign(
    {
      iss: APNS_TEAM_ID,
      iat: now,
    },
    privateKey,
    {
      algorithm: "ES256",
      keyid: APNS_KEY_ID,
    }
  );

  // Cache token for 50 minutes (tokens valid for 1 hour)
  cachedToken = {
    token,
    expiry: now + 3000, // 50 minutes
  };

  return token;
}

/**
 * Sends a push notification to a single device via APNs HTTP/2.
 */
async function sendToDevice(
  deviceToken: string,
  payload: object
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const token = getAPNsToken();
      const payloadString = JSON.stringify(payload);

      console.log(`📤 Sending to device: ${deviceToken.substring(0, 16)}...`);

      const client = http2.connect(`https://${APNS_HOST}`);

      client.on("error", (err) => {
        console.error("❌ HTTP/2 connection error:", err.message);
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

      req.on("response", (headers) => {
        const status = headers[":status"];
        console.log(`   Status: ${status}`);

        if (status === 200) {
          resolve({ success: true });
        }
      });

      req.on("data", (chunk) => {
        responseData += chunk;
      });

      req.on("end", () => {
        client.close();
        if (responseData) {
          try {
            const response = JSON.parse(responseData);
            if (response.reason) {
              console.error(`   Error: ${response.reason}`);
              resolve({ success: false, error: response.reason });
            }
          } catch {
            // Ignore parse errors for empty responses
          }
        }
      });

      req.on("error", (err) => {
        console.error("❌ Request error:", err.message);
        client.close();
        resolve({ success: false, error: err.message });
      });

      // Set timeout
      req.setTimeout(10000, () => {
        console.error("❌ Request timeout");
        req.close();
        client.close();
        resolve({ success: false, error: "Request timeout" });
      });

      req.write(payloadString);
      req.end();
    } catch (error) {
      console.error("❌ Error sending push:", error);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

/**
 * Fetches all active device tokens from Notion.
 */
async function getActiveDevices(notion: Client): Promise<Array<{ token: string; platform: string }>> {
  if (!DEVICE_TOKENS_DATABASE_ID) {
    console.log("⚠️ NOTION_DEVICE_TOKENS_DB_ID not configured");
    return [];
  }

  console.log("📱 Fetching active devices from Notion...");

  try {
    const response = await notion.databases.query({
      database_id: DEVICE_TOKENS_DATABASE_ID,
      filter: {
        property: "Active",
        checkbox: {
          equals: true,
        },
      },
    });

    const devices = response.results.map((page: any) => {
      const tokenProperty = page.properties["Device Token"];
      const platformProperty = page.properties["Platform"];

      return {
        token: tokenProperty?.title?.[0]?.plain_text || "",
        platform: platformProperty?.select?.name || "iOS",
      };
    }).filter((d) => d.token.length > 0);

    console.log(`   Found ${devices.length} active devices`);
    return devices;
  } catch (error) {
    console.error("❌ Error fetching devices:", error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      console.error("❌ Invalid request body:", parsed.error.flatten());
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, body, task_id, priority, badge, sound } = parsed.data;

    console.log("📨 Sending push notification:");
    console.log("   Title:", title);
    console.log("   Body:", body.substring(0, 50) + (body.length > 50 ? "..." : ""));
    console.log("   Task ID:", task_id || "(none)");
    console.log("   Priority:", priority || "(none)");

    // Validate APNs configuration
    if (!APNS_KEY_ID || !APNS_TEAM_ID) {
      console.error("❌ APNs not configured");
      return NextResponse.json(
        { success: false, error: "APNs credentials not configured" },
        { status: 500 }
      );
    }

    // Initialize Notion client
    if (!process.env.NOTION_API_KEY) {
      console.error("❌ NOTION_API_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Notion not configured" },
        { status: 500 }
      );
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    // Get all active devices
    const devices = await getActiveDevices(notion);

    if (devices.length === 0) {
      console.log("⚠️ No active devices to notify");
      return NextResponse.json({
        success: true,
        message: "No active devices to notify",
        sent_to: 0,
        devices: [],
        errors: [],
      });
    }

    // Build APNs payload
    // https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/generating_a_remote_notification
    const payload = {
      aps: {
        alert: {
          title,
          body,
        },
        sound,
        badge,
        "category": "TASK_NOTIFICATION", // Matches iOS notification category
        "mutable-content": 1, // Allow notification service extension to modify
      },
      // Custom payload data (accessible in notification userInfo)
      task_id,
      priority,
      type: "task_notification",
      timestamp: new Date().toISOString(),
    };

    console.log("📦 APNs Payload:", JSON.stringify(payload, null, 2));

    // Send to all devices
    const results: Array<{ device: string; success: boolean; error?: string }> = [];
    const successfulDevices: string[] = [];
    const errors: Array<{ device: string; error: string }> = [];

    for (const device of devices) {
      const result = await sendToDevice(device.token, payload);
      results.push({
        device: device.token.substring(0, 16) + "...",
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        successfulDevices.push(device.token.substring(0, 16) + "..." + ` (${device.platform})`);
      } else {
        errors.push({
          device: device.token.substring(0, 16) + "...",
          error: result.error || "Unknown error",
        });
      }
    }

    const successCount = successfulDevices.length;
    console.log(`✅ Sent to ${successCount}/${devices.length} devices`);

    return NextResponse.json({
      success: successCount > 0,
      message: `Push notification sent to ${successCount} device(s)`,
      sent_to: successCount,
      devices: successfulDevices,
      errors,
    });
  } catch (error) {
    console.error("❌ Error sending push notification:", error);
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
  // Check configuration status
  const config = {
    APNS_KEY_ID: APNS_KEY_ID ? "configured" : "missing",
    APNS_TEAM_ID: APNS_TEAM_ID ? "configured" : "missing",
    APNS_TOPIC,
    APNS_ENVIRONMENT,
    APNS_HOST,
    NOTION_DEVICE_TOKENS_DB_ID: DEVICE_TOKENS_DATABASE_ID ? "configured" : "missing",
  };

  return NextResponse.json({
    endpoint: "/api/send-push",
    method: "POST",
    description: "Send push notification to all registered devices via APNs",
    configuration: config,
    body: {
      title: "string (required) - Notification title",
      body: "string (required) - Notification body",
      task_id: "string (optional) - Task ID for deep linking",
      priority: "string (optional) - Task priority level",
      badge: "number (optional) - Badge count (default: 1)",
      sound: "string (optional) - Sound name (default: 'default')",
    },
    example: {
      title: "Task Reminder",
      body: "Review quarterly report - Due in 1 hour",
      task_id: "notion-page-id",
      priority: "urgent",
    },
    response: {
      success: "boolean - Whether any notifications were sent",
      sent_to: "number - Count of successful deliveries",
      devices: "string[] - List of devices notified",
      errors: "array - Any errors that occurred",
    },
  });
}
