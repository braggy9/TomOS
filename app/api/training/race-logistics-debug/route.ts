export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchAllBlocksDeep, getBlockText } from "@/lib/notion";

export async function GET() {
  const pageId = process.env.NOTION_RACE_LOGISTICS_PAGE_ID!;
  const blocks = await fetchAllBlocksDeep(pageId);

  // Find all H2 indices
  const h2indices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if ((blocks[i] as any).type === "heading_2") h2indices.push(i);
  }

  // Find first non-Dashboard race H2
  let raceStart = -1, raceEnd = blocks.length;
  for (let idx = 0; idx < h2indices.length; idx++) {
    const text = getBlockText(blocks[h2indices[idx]]);
    if (!text.toLowerCase().includes("dashboard")) {
      raceStart = h2indices[idx];
      if (idx + 1 < h2indices.length) raceEnd = h2indices[idx + 1];
      break;
    }
  }

  if (raceStart === -1) {
    return NextResponse.json({ error: "No race H2 found", h2count: h2indices.length });
  }

  const section = blocks.slice(raceStart, raceEnd);
  const digest = section.map((b: any) => ({
    type: b.type,
    text: (b[b.type]?.rich_text?.map((r: any) => r.plain_text).join("") || "").slice(0, 60),
    checked: b.to_do?.checked,
  }));

  return NextResponse.json({
    totalBlocks: blocks.length,
    h2count: h2indices.length,
    firstRaceName: getBlockText(blocks[raceStart]),
    blockCount: section.length,
    blocks: digest,
  });
}
