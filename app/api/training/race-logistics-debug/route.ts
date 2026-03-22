export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchAllBlocksDeep } from "@/lib/notion";

export async function GET() {
  const pageId = process.env.NOTION_RACE_LOGISTICS_PAGE_ID!;
  const blocks = await fetchAllBlocksDeep(pageId);
  const h2idx = blocks.findIndex((b: any) => b.type === "heading_2");
  const nextH2idx = blocks.findIndex((b: any, i: number) => i > h2idx && b.type === "heading_2");
  const section = blocks.slice(h2idx, nextH2idx > 0 ? nextH2idx : h2idx + 40);
  const digest = section.map((b: any) => ({
    type: b.type,
    text: b[b.type]?.rich_text?.map((r: any) => r.plain_text).join("") || "",
    checked: b.to_do?.checked,
  }));
  return NextResponse.json({ totalBlocks: blocks.length, firstRaceBlocks: digest });
}
