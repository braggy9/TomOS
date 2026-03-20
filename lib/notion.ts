import { Client } from "@notionhq/client";

// ─── Singleton Client ────────────────────────────

let client: Client | null = null;

export function getNotionClient(): Client {
  if (!client) {
    const auth = process.env.NOTION_API_KEY?.trim();
    if (!auth) throw new Error("NOTION_API_KEY not set");
    client = new Client({ auth });
  }
  return client;
}

// ─── Block Fetching ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionBlock = any;

/** Fetch all top-level blocks from a page or block (handles pagination) */
export async function fetchAllBlocks(blockId: string): Promise<NotionBlock[]> {
  const notion = getNotionClient();
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const block of response.results) {
      if ("type" in block) blocks.push(block);
    }
    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor);

  return blocks;
}

/**
 * Fetch all blocks recursively, flattening children inline (depth-first).
 * Sibling block fetches are parallelised to avoid serial rate-limit delays.
 * Returns a flat array where each block is immediately followed by its
 * descendants — the structure parseRaceLogisticsBlocks expects.
 */
export async function fetchAllBlocksDeep(blockId: string): Promise<NotionBlock[]> {
  const topLevel = await fetchAllBlocks(blockId);

  // Fetch children for all blocks in parallel
  const childrenResults = await Promise.all(
    topLevel.map((block) =>
      block.has_children ? fetchAllBlocksDeep(block.id) : Promise.resolve([])
    )
  );

  // Interleave: block, then its descendants, in order
  const result: NotionBlock[] = [];
  for (let i = 0; i < topLevel.length; i++) {
    result.push(topLevel[i]);
    result.push(...childrenResults[i]);
  }
  return result;
}

/** Fetch blocks + children for blocks that have them (tables, toggles) */
export async function fetchBlocksWithChildren(
  blockId: string,
  childTypes: string[] = ["table"]
): Promise<{ blocks: NotionBlock[]; children: Map<string, NotionBlock[]> }> {
  const blocks = await fetchAllBlocks(blockId);
  const children = new Map<string, NotionBlock[]>();

  for (const block of blocks) {
    if (block.has_children && childTypes.includes(block.type)) {
      children.set(block.id, await fetchAllBlocks(block.id));
    }
  }

  return { blocks, children };
}

// ─── Text Extraction ─────────────────────────────

/** Extract plain text from a Notion rich_text array */
export function extractPlainText(richText: any[]): string {
  if (!richText?.length) return "";
  return richText.map((rt: any) => rt.plain_text || "").join("");
}

/** Extract text content from any block type */
export function getBlockText(block: NotionBlock): string {
  const content = block[block.type];
  if (content?.rich_text) return extractPlainText(content.rich_text);
  return "";
}

/** Try to extract a bold key + value from a paragraph's rich_text */
export function extractBoldKeyValue(
  richText: any[]
): { key: string; value: string } | null {
  if (!richText?.length) return null;
  const first = richText[0];
  if (!first?.annotations?.bold) return null;

  const key = first.plain_text.replace(/[:\s]+$/, "").trim();
  const value = richText
    .slice(1)
    .map((rt: any) => rt.plain_text || "")
    .join("")
    .trim();

  return { key, value };
}

// ─── Simple In-Memory Cache ──────────────────────

const cacheStore = new Map<string, { data: unknown; expires: number }>();
const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

export function getCached<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (entry && Date.now() < entry.expires) return entry.data as T;
  if (entry) cacheStore.delete(key);
  return null;
}

export function setCache(key: string, data: unknown, ttlMs = DEFAULT_TTL): void {
  cacheStore.set(key, { data, expires: Date.now() + ttlMs });
}

export function clearCache(key?: string): void {
  if (key) cacheStore.delete(key);
  else cacheStore.clear();
}
