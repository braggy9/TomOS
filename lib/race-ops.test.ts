import { describe, expect, it } from "vitest";

import { parseRaceLogisticsBlocks, type NotionBlock } from "./race-ops";

function textBlock(type: "heading_2" | "heading_3" | "paragraph", text: string): NotionBlock {
  return {
    id: `${type}-${text}`,
    type,
    [type]: { rich_text: [{ plain_text: text }] },
  } as NotionBlock;
}

function todo(text: string, checked: boolean): NotionBlock {
  return {
    id: `todo-${text}`,
    type: "to_do",
    to_do: { rich_text: [{ plain_text: text }], checked },
  } as NotionBlock;
}

describe("parseRaceLogisticsBlocks", () => {
  it("uses a completed entry checklist item when Status is only a logistics warning", () => {
    const [race] = parseRaceLogisticsBlocks([
      textBlock("heading_2", "Sunshine Coast Marathon — 2 Aug 2026"),
      textBlock("paragraph", "Status: ⚠️ Items outstanding"),
      textBlock("heading_3", "Entry"),
      todo("Registered and paid (super early bird $200)", true),
    ]);

    expect(race.entryStatus).toBe("registered");
  });

  it("keeps an explicit waitlist entry state even when a paid checklist item exists", () => {
    const [race] = parseRaceLogisticsBlocks([
      textBlock("heading_2", "UTA 22km — 16 May 2026"),
      textBlock("paragraph", "Status: Waitlisted"),
      textBlock("heading_3", "Entry"),
      todo("Paid waitlist fee", true),
    ]);

    expect(race.entryStatus).toBe("waitlisted");
  });
});
