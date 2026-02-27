import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Device Registration Endpoint for APNs Push Notifications
 *
 * Registers iOS/macOS device tokens in PostgreSQL for push notifications.
 *
 * Flow:
 * 1. Device gets APNs token from iOS/macOS
 * 2. Device POSTs token to this endpoint
 * 3. We store/update the token in Postgres (device_tokens table)
 * 4. Later, /api/send-push queries these tokens to send notifications
 */

// Request body validation
const RequestBody = z.object({
  device_token: z.string().min(32).max(200),
  platform: z.enum(["ios", "macos", "ipados"]),
  bundle_id: z.string().optional().default("com.tomos.app"),
  app_version: z.string().optional().default("1.0"),
  name: z.string().optional(),
});

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

    const { device_token, platform, bundle_id, name } = parsed.data;

    console.log(`Registering device: ${device_token.substring(0, 16)}... (${platform})`);

    // Upsert — create or update if token already exists
    const device = await prisma.deviceToken.upsert({
      where: { token: device_token },
      update: {
        platform,
        bundleId: bundle_id,
        name: name || undefined,
        active: true,
        updatedAt: new Date(),
      },
      create: {
        token: device_token,
        platform,
        bundleId: bundle_id,
        name: name || undefined,
        active: true,
      },
    });

    console.log(`Device registered: ${device.id}`);

    return NextResponse.json({
      success: true,
      message: "Device token registered",
      device_id: device.id,
    });
  } catch (error) {
    console.error("Error registering device:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register device",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/debugging
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/register-device",
    method: "POST",
    description: "Register an iOS/macOS device for push notifications",
    database: "PostgreSQL (device_tokens table)",
    body: {
      device_token: "string (required) - APNs device token",
      platform: "string (required) - ios, macos, or ipados",
      bundle_id: "string (optional) - App bundle identifier",
      name: "string (optional) - Device name",
    },
  });
}
