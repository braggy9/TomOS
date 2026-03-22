export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCached,
  setCache,
  clearCache,
} from "@/lib/notion";
import {
  fetchRaceLogisticsFromNotion,
  fetchParentingScheduleFromNotion,
  fetchRaceCalendarFromNotion,
  buildFallbackRaces,
  generateFallbackSchedule,
  enrichRacesWithCustody,
  buildCompleteRaceCard,
  calculateSeasonCost,
  type RaceCard,
  type RaceLogisticsResponse,
} from "@/lib/race-ops";

const CACHE_KEY = "race-logistics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) clearCache(CACHE_KEY);

    // Check cache
    const cached = getCached<RaceLogisticsResponse>(CACHE_KEY);
    if (cached) return NextResponse.json({ success: true, data: cached });

    // Fetch data from multiple sources in parallel
    const [notionRaces, schedule, raceCalendar, dbCosts] = await Promise.all([
      fetchRaceLogisticsFromNotion().catch((e) => {
        console.error("Notion race logistics fetch failed:", e.message);
        return null;
      }),
      fetchParentingScheduleFromNotion().catch((e) => {
        console.error("Notion parenting schedule fetch failed:", e.message);
        return null;
      }),
      fetchRaceCalendarFromNotion().catch((e) => {
        console.error("Notion race calendar fetch failed:", e.message);
        return null;
      }),
      prisma.raceCost.findMany(),
    ]);

    // Use Notion data or fallback
    let partialRaces = notionRaces && notionRaces.length > 0
      ? notionRaces
      : buildFallbackRaces();

    const custodySchedule = schedule && schedule.length > 0
      ? schedule
      : generateFallbackSchedule();

    // Apply entry statuses from Race Calendar table
    if (raceCalendar && raceCalendar.size > 0) {
      partialRaces = partialRaces.map((race) => {
        const status = raceCalendar.get(race.id || "");
        if (status) return { ...race, entryStatus: status };
        return race;
      });
    }

    // Enrich with custody data
    partialRaces = enrichRacesWithCustody(partialRaces, custodySchedule);

    // Build cost map from DB
    const costMap = new Map(dbCosts.map((c) => [c.raceSlug, c]));

    // Assemble complete race cards
    const races: RaceCard[] = partialRaces
      .map((partial) => buildCompleteRaceCard(partial, costMap.get(partial.id || "") || null))
      .sort((a, b) => {
        // Sort: active races by date (soonest first), dropped/past at end
        if (a.entryStatus === "dropped" && b.entryStatus !== "dropped") return 1;
        if (b.entryStatus === "dropped" && a.entryStatus !== "dropped") return -1;
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return 1;
        return a.date.localeCompare(b.date);
      });

    const response: RaceLogisticsResponse = {
      lastFetched: new Date().toISOString(),
      races,
      seasonCost: calculateSeasonCost(races),
    };

    // Cache for 15 minutes
    setCache(CACHE_KEY, response);

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("Race logistics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch race logistics", details: String(error) },
      { status: 500 }
    );
  }
}
