import { NextResponse } from "next/server";
import { z } from "zod";
import { Client } from "@notionhq/client";

/**
 * Device Registration Endpoint for APNs Push Notifications
 *
 * This endpoint registers iOS/macOS device tokens with our Notion database.
 * When a device installs the TomOS app and grants notification permissions,
 * APNs provides a unique device token. The app sends this token here for storage.
 *
 * Flow:
 * 1. Device gets APNs token from iOS/macOS
 * 2. Device POSTs token to this endpoint
 * 3. We store/update the token in Notion
 * 4. Later, /api/send-push queries these tokens to send notifications
 *
 * Database Schema (auto-created if needed):
 * - Device Token (title): The APNs device token (64 hex characters)
 * - Platform (select): iOS, macOS, or iPadOS
 * - Last Updated (date): When the device was last seen
 * - Active (checkbox): Whether to send notifications to this device
 * - Bundle ID (rich_text): App bundle identifier
 * - App Version (rich_text): App version number
 */

// Request body validation
const RequestBody = z.object({
  device_token: z.string().min(32).max(200), // APNs tokens are typically 64 hex chars
  platform: z.enum(["ios", "macos", "ipados"]),
  bundle_id: z.string().optional().default("com.tomos.app"),
  app_version: z.string().optional().default("1.0"),
});

// Environment variable for the device tokens database
// This will be created automatically if it doesn't exist
const DEVICE_TOKENS_DATABASE_ID = process.env.NOTION_DEVICE_TOKENS_DB_ID;

// Parent page ID where the database will be created if needed
// Must be a PAGE id, not a database id
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID || "26f46505452d8001a172c824053753e9";

/**
 * Creates the Device Tokens database in Notion if it doesn't exist.
 * Returns the database ID.
 */
async function ensureDeviceTokensDatabase(notion: Client): Promise<string> {
  // If we have a database ID configured, verify it exists
  if (DEVICE_TOKENS_DATABASE_ID) {
    try {
      await notion.databases.retrieve({ database_id: DEVICE_TOKENS_DATABASE_ID });
      console.log("📱 Device tokens database found:", DEVICE_TOKENS_DATABASE_ID);
      return DEVICE_TOKENS_DATABASE_ID;
    } catch (error) {
      console.log("⚠️ Configured database not found, will create new one");
    }
  }

  // Search for existing "Device Tokens" database
  console.log("🔍 Searching for existing Device Tokens database...");
  const searchResponse = await notion.search({
    query: "Device Tokens",
    filter: { property: "object", value: "database" },
  });

  const existingDb = searchResponse.results.find(
    (result) => result.object === "database" &&
    "title" in result &&
    result.title?.[0]?.plain_text === "Device Tokens"
  );

  if (existingDb) {
    console.log("✅ Found existing Device Tokens database:", existingDb.id);
    return existingDb.id;
  }

  // Create new database
  console.log("📝 Creating new Device Tokens database...");
  const newDatabase = await notion.databases.create({
    parent: { page_id: NOTION_PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "Device Tokens" } }],
    properties: {
      "Device Token": {
        title: {},
      },
      "Platform": {
        select: {
          options: [
            { name: "iOS", color: "blue" },
            { name: "macOS", color: "purple" },
            { name: "iPadOS", color: "green" },
          ],
        },
      },
      "Last Updated": {
        date: {},
      },
      "Active": {
        checkbox: {},
      },
      "Bundle ID": {
        rich_text: {},
      },
      "App Version": {
        rich_text: {},
      },
    },
  });

  console.log("✅ Created Device Tokens database:", newDatabase.id);
  console.log("⚠️ Add NOTION_DEVICE_TOKENS_DB_ID=" + newDatabase.id + " to your environment variables");

  return newDatabase.id;
}

/**
 * Finds an existing device token entry in the database.
 */
async function findExistingDevice(
  notion: Client,
  databaseId: string,
  deviceToken: string
): Promise<string | null> {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Device Token",
      title: {
        equals: deviceToken,
      },
    },
  });

  if (response.results.length > 0) {
    return response.results[0].id;
  }
  return null;
}

/**
 * Normalizes platform name for Notion select property.
 */
function normalizePlatform(platform: string): string {
  switch (platform.toLowerCase()) {
    case "ios":
      return "iOS";
    case "macos":
      return "macOS";
    case "ipados":
      return "iPadOS";
    default:
      return "iOS";
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

    const { device_token, platform, bundle_id, app_version } = parsed.data;

    console.log("📱 Registering device token:");
    console.log("   Token:", device_token.substring(0, 16) + "...");
    console.log("   Platform:", platform);
    console.log("   Bundle ID:", bundle_id);
    console.log("   App Version:", app_version);

    // Initialize Notion client
    if (!process.env.NOTION_API_KEY) {
      console.error("❌ NOTION_API_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    // Ensure database exists
    const databaseId = await ensureDeviceTokensDatabase(notion);

    // Check if device already exists
    const existingPageId = await findExistingDevice(notion, databaseId, device_token);
    const now = new Date().toISOString();

    if (existingPageId) {
      // Update existing device
      console.log("🔄 Updating existing device:", existingPageId);

      await notion.pages.update({
        page_id: existingPageId,
        properties: {
          "Platform": {
            select: { name: normalizePlatform(platform) },
          },
          "Last Updated": {
            date: { start: now },
          },
          "Active": {
            checkbox: true,
          },
          "Bundle ID": {
            rich_text: [{ type: "text", text: { content: bundle_id } }],
          },
          "App Version": {
            rich_text: [{ type: "text", text: { content: app_version } }],
          },
        },
      });

      console.log("✅ Device updated successfully");
      return NextResponse.json({
        success: true,
        message: "Device token updated",
        device_id: existingPageId,
      });
    } else {
      // Create new device entry
      console.log("➕ Creating new device entry");

      const newPage = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          "Device Token": {
            title: [{ type: "text", text: { content: device_token } }],
          },
          "Platform": {
            select: { name: normalizePlatform(platform) },
          },
          "Last Updated": {
            date: { start: now },
          },
          "Active": {
            checkbox: true,
          },
          "Bundle ID": {
            rich_text: [{ type: "text", text: { content: bundle_id } }],
          },
          "App Version": {
            rich_text: [{ type: "text", text: { content: app_version } }],
          },
        },
      });

      console.log("✅ Device registered successfully:", newPage.id);
      return NextResponse.json({
        success: true,
        message: "Device token registered",
        device_id: newPage.id,
      });
    }
  } catch (error) {
    console.error("❌ Error registering device:", error);
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
    body: {
      device_token: "string (required) - APNs device token",
      platform: "string (required) - ios, macos, or ipados",
      bundle_id: "string (optional) - App bundle identifier",
      app_version: "string (optional) - App version number",
    },
    example: {
      device_token: "a1b2c3d4e5f6...",
      platform: "ios",
      bundle_id: "com.tomos.app",
      app_version: "1.0",
    },
  });
}
