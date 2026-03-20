import {
  fetchAllBlocks,
  fetchAllBlocksDeep,
  fetchBlocksWithChildren,
  getBlockText,
  extractPlainText,
  extractBoldKeyValue,
  type NotionBlock,
} from "./notion";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type EntryStatus = "registered" | "chasing" | "waitlisted" | "tbc" | "dropped";
export type LogisticsStatus = "sorted" | "outstanding" | "urgent";
export type RaceType = "road" | "trail";

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface RaceCosts {
  entryFee: { amount: number | null; paid: boolean; note: string | null };
  accommodation: { estimated: number | null; booked: number | null; note: string | null };
  travel: { estimated: number | null; booked: number | null; note: string | null };
  gear: { amount: number | null; note: string | null };
  food: { amount: number | null; note: string | null };
  other: { amount: number | null; note: string | null };
  total: number;
}

export interface RaceCard {
  id: string;
  name: string;
  shortName: string;
  date: string | null;
  dateDisplay: string;
  distance: string;
  type: RaceType;
  location: string;
  entryStatus: EntryStatus;
  logisticsStatus: LogisticsStatus;
  daysOut: number | null;
  isARace: boolean;
  kidsWeek: boolean | null;
  custodyNote: string | null;
  needsChildcare: boolean;
  childcareSorted: boolean;
  needsAccommodation: boolean;
  accommodationSorted: boolean;
  needsTravel: boolean;
  travelSorted: boolean;
  needsMiloCare: boolean;
  miloCareSorted: boolean;
  checklists: {
    entry: ChecklistItem[];
    kidsWeekLogistics: ChecklistItem[] | null;
    supportCrew: ChecklistItem[];
    accommodation: ChecklistItem[] | null;
    travel: ChecklistItem[];
    gearNutrition: ChecklistItem[];
    raceWeek: ChecklistItem[];
  };
  costs: RaceCosts;
  notes: string | null;
  raceShoes: string | null;
  target: string | null;
}

export interface SeasonCost {
  totalPaid: number;
  totalEstimated: number;
  byCategory: {
    entries: number;
    accommodation: number;
    travel: number;
    gear: number;
    food: number;
    other: number;
  };
}

export interface CustodyWeek {
  startDate: string;
  endDate: string;
  status: "kids" | "solo";
  raceNote: string | null;
  hasRaceConflict: boolean;
}

export interface RaceLogisticsResponse {
  lastFetched: string;
  races: RaceCard[];
  seasonCost: SeasonCost;
}

export interface ParentingScheduleResponse {
  lastFetched: string;
  weeks: CustodyWeek[];
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function calculateDaysOut(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  // Use Sydney approximate date
  const sydney = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
  const race = new Date(dateStr + "T00:00:00");
  const diff = race.getTime() - sydney.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function parseDateFromDisplay(text: string): string | null {
  if (!text || text.toLowerCase().startsWith("tbc")) return null;
  // Try "6 Apr 2026" format
  const match = text.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (match) {
    const [, day, mon, year] = match;
    const m = MONTHS[mon];
    if (m) return `${year}-${m}-${day.padStart(2, "0")}`;
  }
  // Try "26-28 Nov 2026" range format — use first date
  const rangeMatch = text.match(/(\d{1,2})[-–]\d{1,2}\s+(\w{3})\s+(\d{4})/);
  if (rangeMatch) {
    const [, day, mon, year] = rangeMatch;
    const m = MONTHS[mon];
    if (m) return `${year}-${m}-${day.padStart(2, "0")}`;
  }
  return null;
}

export function mapEntryStatus(text: string): EntryStatus {
  const t = text.toLowerCase();
  if (t.includes("registered") || t.includes("✅")) return "registered";
  if (t.includes("transfer") || t.includes("chasing")) return "chasing";
  if (t.includes("waitlist") || t.includes("⏳")) return "waitlisted";
  if (t.includes("dropped")) return "dropped";
  return "tbc";
}

export function calculateLogisticsStatus(race: Partial<RaceCard>): LogisticsStatus {
  const checklists = race.checklists;
  if (!checklists) return "outstanding";

  const allItems = Object.values(checklists)
    .filter(Boolean)
    .flat() as ChecklistItem[];
  if (allItems.length > 0 && allItems.every((item) => item.checked)) return "sorted";

  const daysOut = race.daysOut ?? null;
  if (daysOut !== null) {
    if (daysOut < 30) return "urgent";
    if (race.kidsWeek && race.needsChildcare && !race.childcareSorted && daysOut < 45) return "urgent";
    if (race.needsAccommodation && !race.accommodationSorted && daysOut < 60) return "urgent";
  }

  return "outstanding";
}

export function calculateSeasonCost(races: RaceCard[]): SeasonCost {
  const result: SeasonCost = {
    totalPaid: 0,
    totalEstimated: 0,
    byCategory: { entries: 0, accommodation: 0, travel: 0, gear: 0, food: 0, other: 0 },
  };

  for (const race of races) {
    const c = race.costs;
    if (c.entryFee.amount) {
      result.byCategory.entries += c.entryFee.amount;
      if (c.entryFee.paid) result.totalPaid += c.entryFee.amount;
      else result.totalEstimated += c.entryFee.amount;
    }
    if (c.accommodation.booked) {
      result.byCategory.accommodation += c.accommodation.booked;
      result.totalPaid += c.accommodation.booked;
    } else if (c.accommodation.estimated) {
      result.byCategory.accommodation += c.accommodation.estimated;
      result.totalEstimated += c.accommodation.estimated;
    }
    if (c.travel.booked) {
      result.byCategory.travel += c.travel.booked;
      result.totalPaid += c.travel.booked;
    } else if (c.travel.estimated) {
      result.byCategory.travel += c.travel.estimated;
      result.totalEstimated += c.travel.estimated;
    }
    if (c.gear.amount) { result.byCategory.gear += c.gear.amount; result.totalEstimated += c.gear.amount; }
    if (c.food.amount) { result.byCategory.food += c.food.amount; result.totalEstimated += c.food.amount; }
    if (c.other.amount) { result.byCategory.other += c.other.amount; result.totalEstimated += c.other.amount; }
  }

  return result;
}

function emptyCosts(): RaceCosts {
  return {
    entryFee: { amount: null, paid: false, note: null },
    accommodation: { estimated: null, booked: null, note: null },
    travel: { estimated: null, booked: null, note: null },
    gear: { amount: null, note: null },
    food: { amount: null, note: null },
    other: { amount: null, note: null },
    total: 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbCostToRaceCosts(row: any | null): RaceCosts {
  if (!row) return emptyCosts();
  const costs: RaceCosts = {
    entryFee: { amount: row.entryFee, paid: row.entryPaid, note: row.entryNote },
    accommodation: { estimated: row.accomEst, booked: row.accomBooked, note: row.accomNote },
    travel: { estimated: row.travelEst, booked: row.travelBooked, note: row.travelNote },
    gear: { amount: row.gear, note: row.gearNote },
    food: { amount: row.food, note: row.foodNote },
    other: { amount: row.other, note: row.otherNote },
    total: 0,
  };
  costs.total =
    (costs.entryFee.amount || 0) +
    (costs.accommodation.booked || costs.accommodation.estimated || 0) +
    (costs.travel.booked || costs.travel.estimated || 0) +
    (costs.gear.amount || 0) +
    (costs.food.amount || 0) +
    (costs.other.amount || 0);
  return costs;
}

// ═══════════════════════════════════════════════
// NOTION BLOCK PARSERS
// ═══════════════════════════════════════════════

/** Parse the Race Logistics Notion page blocks into partial RaceCard data */
export function parseRaceLogisticsBlocks(blocks: NotionBlock[]): Partial<RaceCard>[] {
  const races: Partial<RaceCard>[] = [];

  // Find all heading_2 indices (each = a race section)
  const h2Indices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === "heading_2") h2Indices.push(i);
  }

  for (let idx = 0; idx < h2Indices.length; idx++) {
    const start = h2Indices[idx];
    const end = idx + 1 < h2Indices.length ? h2Indices[idx + 1] : blocks.length;
    const sectionBlocks = blocks.slice(start, end);

    // Skip "Dashboard" section
    const headingText = getBlockText(sectionBlocks[0]);
    if (headingText.toLowerCase().includes("dashboard")) continue;

    const race = parseRaceSection(sectionBlocks);
    if (race) races.push(race);
  }

  return races;
}

function parseRaceSection(blocks: NotionBlock[]): Partial<RaceCard> | null {
  if (!blocks.length) return null;

  const headingText = getBlockText(blocks[0]);
  const { name, dateStr } = parseRaceHeading(headingText);
  if (!name) return null;

  const race: Partial<RaceCard> = {
    id: generateSlug(name),
    name,
    shortName: shortenRaceName(name),
    date: dateStr,
    dateDisplay: dateStr ? formatDateDisplay(dateStr) : "TBC",
    daysOut: calculateDaysOut(dateStr),
    checklists: {
      entry: [],
      kidsWeekLogistics: null,
      supportCrew: [],
      accommodation: null,
      travel: [],
      gearNutrition: [],
      raceWeek: [],
    },
  };

  // Parse metadata from paragraph blocks before first h3
  let currentSection: string | null = null;
  let currentChecklist: ChecklistItem[] = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "heading_3") {
      // Save previous section's checklist
      if (currentSection) {
        assignChecklist(race, currentSection, currentChecklist);
      }
      currentSection = getBlockText(block).toLowerCase().trim();
      currentChecklist = [];
      continue;
    }

    if (block.type === "to_do") {
      currentChecklist.push({
        text: getBlockText(block),
        checked: block.to_do?.checked ?? false,
      });
      continue;
    }

    if (block.type === "paragraph") {
      const richText = block.paragraph?.rich_text;
      if (!richText?.length) continue;
      const kv = extractBoldKeyValue(richText);
      if (kv) applyMetadata(race, kv.key, kv.value);
    }

    if (block.type === "bulleted_list_item" && currentSection) {
      // Some checklist items might be bulleted lists instead of to_do
      currentChecklist.push({
        text: getBlockText(block),
        checked: getBlockText(block).includes("✅") || getBlockText(block).includes("Done"),
      });
    }
  }

  // Save last section
  if (currentSection) {
    assignChecklist(race, currentSection, currentChecklist);
  }

  return race;
}

function parseRaceHeading(text: string): { name: string | null; dateStr: string | null } {
  // Format: "Race Name — 6 Apr 2026" or "Race Name — TBC Nov 2026"
  const parts = text.split(/\s*[—–-]\s*/);
  if (parts.length < 2) return { name: text.trim() || null, dateStr: null };
  const name = parts[0].trim();
  const dateStr = parseDateFromDisplay(parts.slice(1).join(" ").trim());
  return { name: name || null, dateStr };
}

function shortenRaceName(name: string): string {
  return name
    .replace(/Sri Chinmoy\s+/i, "")
    .replace(/Ultra-Trail\s+/i, "")
    .replace(/Half Marathon/i, "Half")
    .replace(/Marathon/i, "Marathon")
    .replace(/Challenge/i, "")
    .replace(/Classic/i, "")
    .trim();
}

function applyMetadata(race: Partial<RaceCard>, key: string, value: string): void {
  const k = key.toLowerCase();
  if (k === "distance") race.distance = value;
  else if (k === "type") race.type = value.toLowerCase().includes("trail") ? "trail" : "road";
  else if (k === "location") race.location = value;
  else if (k.includes("kids") && k.includes("week")) {
    const v = value.toLowerCase();
    race.kidsWeek = v.includes("yes") || v.includes("🧒") || v.includes("kids");
    if (v.includes("solo") || v.includes("no")) race.kidsWeek = false;
    if (v.includes("tbc")) race.kidsWeek = null;
    race.custodyNote = value;
  } else if (k === "race shoes") race.raceShoes = value;
  else if (k === "target") race.target = value;
  else if (k === "status") race.entryStatus = mapEntryStatus(value);
}

function assignChecklist(race: Partial<RaceCard>, section: string, items: ChecklistItem[]): void {
  if (!race.checklists) return;
  const s = section.replace(/[^a-z\s]/g, "").trim();
  if (s.includes("entry")) race.checklists.entry = items;
  else if (s.includes("kids") && s.includes("logistics")) race.checklists.kidsWeekLogistics = items;
  else if (s.includes("support")) race.checklists.supportCrew = items;
  else if (s.includes("accommodation") || s.includes("accom")) race.checklists.accommodation = items;
  else if (s.includes("travel")) race.checklists.travel = items;
  else if (s.includes("gear") || s.includes("nutrition")) race.checklists.gearNutrition = items;
  else if (s.includes("race week")) race.checklists.raceWeek = items;
}

/** Parse parenting schedule table rows from Training Hub */
export function parseParentingTableRows(rows: NotionBlock[]): CustodyWeek[] {
  const weeks: CustodyWeek[] = [];

  for (const row of rows) {
    if (row.type !== "table_row") continue;
    const cells = row.table_row?.cells;
    if (!cells || cells.length < 3) continue;

    const startText = extractPlainText(cells[0]);
    const endText = extractPlainText(cells[1]);
    const statusText = extractPlainText(cells[2]).toLowerCase();
    const raceNote = cells.length > 3 ? extractPlainText(cells[3]) || null : null;

    // Parse dates — try to extract from text like "6 Mar" or "2026-03-06"
    const startDate = parseDateFromDisplay(startText + " 2026") || startText;
    const endDate = parseDateFromDisplay(endText + " 2026") || endText;

    // Skip header row
    if (statusText.includes("status") || statusText.includes("week")) continue;

    weeks.push({
      startDate,
      endDate,
      status: statusText.includes("kids") || statusText.includes("🧒") ? "kids" : "solo",
      raceNote: raceNote || null,
      hasRaceConflict: !!raceNote && raceNote.includes("⚠"),
    });
  }

  return weeks;
}

/** Parse race calendar table rows from Training Hub */
export function parseRaceCalendarRows(rows: NotionBlock[]): Map<string, EntryStatus> {
  const statuses = new Map<string, EntryStatus>();

  for (const row of rows) {
    if (row.type !== "table_row") continue;
    const cells = row.table_row?.cells;
    if (!cells || cells.length < 6) continue;

    const raceName = extractPlainText(cells[0]);
    const statusText = extractPlainText(cells[5]); // Status is the 6th column

    // Skip header row
    if (raceName.toLowerCase().includes("race") && statusText.toLowerCase().includes("status")) continue;

    if (raceName) {
      statuses.set(generateSlug(raceName), mapEntryStatus(statusText));
    }
  }

  return statuses;
}

// ═══════════════════════════════════════════════
// HIGH-LEVEL FETCH FUNCTIONS
// ═══════════════════════════════════════════════

/** Fetch and parse race logistics from Notion */
export async function fetchRaceLogisticsFromNotion(): Promise<Partial<RaceCard>[]> {
  const pageId = process.env.NOTION_RACE_LOGISTICS_PAGE_ID;
  if (!pageId) throw new Error("NOTION_RACE_LOGISTICS_PAGE_ID not set");

  const blocks = await fetchAllBlocksDeep(pageId);
  return parseRaceLogisticsBlocks(blocks);
}

/** Fetch parenting schedule from the Training Hub Notion page */
export async function fetchParentingScheduleFromNotion(): Promise<CustodyWeek[]> {
  const pageId = process.env.NOTION_TRAINING_HUB_PAGE_ID;
  if (!pageId) throw new Error("NOTION_TRAINING_HUB_PAGE_ID not set");

  const { blocks, children } = await fetchBlocksWithChildren(pageId);

  // Find "Parenting Schedule" heading, then the next table
  let foundScheduleHeading = false;
  for (const block of blocks) {
    if (
      (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") &&
      getBlockText(block).toLowerCase().includes("parenting schedule")
    ) {
      foundScheduleHeading = true;
      continue;
    }
    if (foundScheduleHeading && block.type === "table") {
      const rows = children.get(block.id) || [];
      const parsed = parseParentingTableRows(rows);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

/** Fetch race calendar entry statuses from Training Hub */
export async function fetchRaceCalendarFromNotion(): Promise<Map<string, EntryStatus>> {
  const pageId = process.env.NOTION_TRAINING_HUB_PAGE_ID;
  if (!pageId) throw new Error("NOTION_TRAINING_HUB_PAGE_ID not set");

  const { blocks, children } = await fetchBlocksWithChildren(pageId);

  let foundCalendarHeading = false;
  for (const block of blocks) {
    if (
      (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") &&
      getBlockText(block).toLowerCase().includes("race calendar")
    ) {
      foundCalendarHeading = true;
      continue;
    }
    if (foundCalendarHeading && block.type === "table") {
      const rows = children.get(block.id) || [];
      return parseRaceCalendarRows(rows);
    }
  }

  return new Map();
}

// ═══════════════════════════════════════════════
// FALLBACK DATA
// ═══════════════════════════════════════════════

interface FallbackRace {
  id: string;
  name: string;
  shortName: string;
  date: string | null;
  dateDisplay: string;
  distance: string;
  type: RaceType;
  location: string;
  entryStatus: EntryStatus;
  isARace: boolean;
  needsAccom: boolean;
  needsTravel: boolean;
  needsMilo: boolean;
}

const FALLBACK_RACE_DATA: FallbackRace[] = [
  { id: "cp-half", name: "Sri Chinmoy Centennial Park Half", shortName: "CP Half", date: "2026-04-06", dateDisplay: "6 Apr 2026", distance: "21.1km", type: "road", location: "Centennial Park, Sydney", entryStatus: "registered", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "jabulani-22km", name: "Jabulani Challenge 22km", shortName: "Jabulani 22km", date: "2026-04-11", dateDisplay: "11 Apr 2026", distance: "22km", type: "trail", location: "Ku-ring-gai Chase National Park", entryStatus: "registered", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "uta-22km", name: "UTA 22km Katoomba", shortName: "UTA 22km", date: "2026-05-16", dateDisplay: "16 May 2026", distance: "22km", type: "trail", location: "Katoomba, Blue Mountains", entryStatus: "waitlisted", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "iron-cove-half", name: "Sri Chinmoy Iron Cove Half", shortName: "Iron Cove Half", date: "2026-06-07", dateDisplay: "7 Jun 2026", distance: "21.1km", type: "road", location: "Iron Cove, Sydney", entryStatus: "registered", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "gc-marathon", name: "Gold Coast Marathon", shortName: "GC Marathon", date: "2026-07-05", dateDisplay: "5 Jul 2026", distance: "42.2km", type: "road", location: "Gold Coast, QLD", entryStatus: "chasing", isARace: false, needsAccom: true, needsTravel: true, needsMilo: true },
  { id: "dolls-point-half", name: "Sri Chinmoy Dolls Point Half", shortName: "Dolls Point Half", date: "2026-07-12", dateDisplay: "12 Jul 2026", distance: "21.1km", type: "road", location: "Dolls Point, Sydney", entryStatus: "registered", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "sunshine-coast-marathon", name: "Sunshine Coast Marathon", shortName: "Sunshine Coast", date: "2026-08-02", dateDisplay: "2 Aug 2026", distance: "42.2km", type: "road", location: "Sunshine Coast, QLD", entryStatus: "registered", isARace: true, needsAccom: true, needsTravel: true, needsMilo: true },
  { id: "tcs-sydney-marathon", name: "TCS Sydney Marathon", shortName: "Sydney Marathon", date: "2026-08-30", dateDisplay: "30 Aug 2026", distance: "42.2km", type: "road", location: "Sydney CBD", entryStatus: "dropped", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "hounslow-17km", name: "Hounslow Classic 17km", shortName: "Hounslow 17km", date: "2026-09-12", dateDisplay: "12 Sep 2026", distance: "17km", type: "trail", location: "Blue Mountains", entryStatus: "registered", isARace: false, needsAccom: true, needsTravel: true, needsMilo: true },
  { id: "rnp-marathon", name: "Sri Chinmoy RNP Marathon", shortName: "RNP Marathon", date: null, dateDisplay: "TBC Nov 2026", distance: "42.2km", type: "trail", location: "Royal National Park", entryStatus: "registered", isARace: false, needsAccom: false, needsTravel: false, needsMilo: false },
  { id: "kosi-50km", name: "Ultra-Trail Kosciuszko 50km", shortName: "Kosi 50km", date: "2026-11-26", dateDisplay: "26 Nov 2026", distance: "50km", type: "trail", location: "Perisher, NSW", entryStatus: "registered", isARace: true, needsAccom: true, needsTravel: true, needsMilo: true },
];

export function buildFallbackRaces(): Partial<RaceCard>[] {
  return FALLBACK_RACE_DATA.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    date: r.date,
    dateDisplay: r.dateDisplay,
    distance: r.distance,
    type: r.type,
    location: r.location,
    entryStatus: r.entryStatus,
    isARace: r.isARace,
    daysOut: calculateDaysOut(r.date),
    kidsWeek: null, // Will be enriched from schedule
    custodyNote: null,
    needsChildcare: false,
    childcareSorted: false,
    needsAccommodation: r.needsAccom,
    accommodationSorted: false,
    needsTravel: r.needsTravel,
    travelSorted: false,
    needsMiloCare: r.needsMilo,
    miloCareSorted: false,
    checklists: {
      entry: [],
      kidsWeekLogistics: null,
      supportCrew: [],
      accommodation: r.needsAccom ? [] : null,
      travel: [],
      gearNutrition: [],
      raceWeek: [],
    },
    notes: null,
    raceShoes: null,
    target: null,
  }));
}

/** Generate parenting schedule from known pattern (alternating weeks from 6 Mar 2026) */
export function generateFallbackSchedule(): CustodyWeek[] {
  const weeks: CustodyWeek[] = [];
  const startDate = new Date("2026-03-06T12:00:00"); // Friday 6 Mar
  let isSolo = true; // 6 Mar is Solo

  for (let i = 0; i < 44; i++) {
    // ~10 months of weeks
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    weeks.push({
      startDate: weekStart.toISOString().split("T")[0],
      endDate: weekEnd.toISOString().split("T")[0],
      status: isSolo ? "solo" : "kids",
      raceNote: null,
      hasRaceConflict: false,
    });

    isSolo = !isSolo;
  }

  return weeks;
}

// ═══════════════════════════════════════════════
// ASSEMBLERS
// ═══════════════════════════════════════════════

/** Enrich races with custody info from the parenting schedule */
export function enrichRacesWithCustody(
  races: Partial<RaceCard>[],
  schedule: CustodyWeek[]
): Partial<RaceCard>[] {
  return races.map((race) => {
    if (!race.date) return race;

    const raceDate = new Date(race.date + "T12:00:00");
    const week = schedule.find((w) => {
      const start = new Date(w.startDate + "T00:00:00");
      const end = new Date(w.endDate + "T00:00:00");
      return raceDate >= start && raceDate < end;
    });

    if (!week) return race;

    const isKidsWeek = week.status === "kids";
    return {
      ...race,
      kidsWeek: isKidsWeek,
      needsChildcare: isKidsWeek,
      custodyNote: isKidsWeek ? "Kids week — childcare needed" : "Solo week",
    };
  });
}

/** Enrich parenting schedule with race info */
export function enrichScheduleWithRaces(
  schedule: CustodyWeek[],
  races: Partial<RaceCard>[]
): CustodyWeek[] {
  return schedule.map((week) => {
    const weekStart = new Date(week.startDate + "T00:00:00");
    const weekEnd = new Date(week.endDate + "T00:00:00");

    const racesInWeek = races.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date + "T12:00:00");
      return d >= weekStart && d < weekEnd;
    });

    if (racesInWeek.length === 0) return week;

    const notes = racesInWeek
      .map((r) => `${r.shortName || r.name} — ${r.dateDisplay}`)
      .join(", ");
    const hasConflict = week.status === "kids" && racesInWeek.length > 0;

    return {
      ...week,
      raceNote: notes,
      hasRaceConflict: hasConflict,
    };
  });
}

/** Build a complete RaceCard from partial Notion data + DB cost */
export function buildCompleteRaceCard(
  partial: Partial<RaceCard>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbCost: any | null
): RaceCard {
  const card: RaceCard = {
    id: partial.id || generateSlug(partial.name || "unknown"),
    name: partial.name || "Unknown Race",
    shortName: partial.shortName || partial.name || "Unknown",
    date: partial.date || null,
    dateDisplay: partial.dateDisplay || "TBC",
    distance: partial.distance || "?",
    type: partial.type || "road",
    location: partial.location || "TBC",
    entryStatus: partial.entryStatus || "tbc",
    logisticsStatus: "outstanding",
    daysOut: partial.daysOut ?? calculateDaysOut(partial.date || null),
    isARace: partial.isARace || false,
    kidsWeek: partial.kidsWeek ?? null,
    custodyNote: partial.custodyNote || null,
    needsChildcare: partial.needsChildcare || false,
    childcareSorted: partial.childcareSorted || false,
    needsAccommodation: partial.needsAccommodation || false,
    accommodationSorted: partial.accommodationSorted || false,
    needsTravel: partial.needsTravel || false,
    travelSorted: partial.travelSorted || false,
    needsMiloCare: partial.needsMiloCare || false,
    miloCareSorted: partial.miloCareSorted || false,
    checklists: partial.checklists || {
      entry: [],
      kidsWeekLogistics: null,
      supportCrew: [],
      accommodation: null,
      travel: [],
      gearNutrition: [],
      raceWeek: [],
    },
    costs: dbCostToRaceCosts(dbCost),
    notes: partial.notes || null,
    raceShoes: partial.raceShoes || null,
    target: partial.target || null,
  };

  card.logisticsStatus = calculateLogisticsStatus(card);
  return card;
}
