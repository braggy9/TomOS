import { NextResponse } from "next/server";
import { getCached, setCache, clearCache } from "@/lib/notion";
import {
  fetchParentingScheduleFromNotion,
  generateFallbackSchedule,
  enrichScheduleWithRaces,
  fetchRaceLogisticsFromNotion,
  buildFallbackRaces,
  type ParentingScheduleResponse,
} from "@/lib/race-ops";

const CACHE_KEY = "parenting-schedule";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) clearCache(CACHE_KEY);

    // Check cache
    const cached = getCached<ParentingScheduleResponse>(CACHE_KEY);
    if (cached) return NextResponse.json({ success: true, data: cached });

    // Fetch from Notion or use fallback
    const [notionSchedule, notionRaces] = await Promise.all([
      fetchParentingScheduleFromNotion().catch((e) => {
        console.error("Notion schedule fetch failed:", e.message);
        return null;
      }),
      fetchRaceLogisticsFromNotion().catch((e) => {
        console.error("Notion races fetch failed:", e.message);
        return null;
      }),
    ]);

    let schedule = notionSchedule && notionSchedule.length > 0
      ? notionSchedule
      : generateFallbackSchedule();

    const races = notionRaces && notionRaces.length > 0
      ? notionRaces
      : buildFallbackRaces();

    // Enrich schedule with race info
    schedule = enrichScheduleWithRaces(schedule, races);

    const response: ParentingScheduleResponse = {
      lastFetched: new Date().toISOString(),
      weeks: schedule,
    };

    // Cache for 15 minutes
    setCache(CACHE_KEY, response);

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("Parenting schedule error:", error);
    return NextResponse.json(
      { error: "Failed to fetch parenting schedule", details: String(error) },
      { status: 500 }
    );
  }
}
