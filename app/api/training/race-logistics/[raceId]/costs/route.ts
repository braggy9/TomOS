import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearCache } from "@/lib/notion";
import { z } from "zod";

const costSchema = z.object({
  entryFee: z.object({ amount: z.number(), paid: z.boolean(), note: z.string().optional() }).optional(),
  accommodation: z.object({ estimated: z.number().optional(), booked: z.number().optional(), note: z.string().optional() }).optional(),
  travel: z.object({ estimated: z.number().optional(), booked: z.number().optional(), note: z.string().optional() }).optional(),
  gear: z.object({ amount: z.number(), note: z.string().optional() }).optional(),
  food: z.object({ amount: z.number(), note: z.string().optional() }).optional(),
  other: z.object({ amount: z.number(), note: z.string().optional() }).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { raceId: string } }
) {
  try {
    const { raceId } = params;
    const body = await request.json();
    const parsed = costSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};

    if (data.entryFee) {
      update.entryFee = data.entryFee.amount;
      update.entryPaid = data.entryFee.paid;
      if (data.entryFee.note !== undefined) update.entryNote = data.entryFee.note;
    }
    if (data.accommodation) {
      if (data.accommodation.estimated !== undefined) update.accomEst = data.accommodation.estimated;
      if (data.accommodation.booked !== undefined) update.accomBooked = data.accommodation.booked;
      if (data.accommodation.note !== undefined) update.accomNote = data.accommodation.note;
    }
    if (data.travel) {
      if (data.travel.estimated !== undefined) update.travelEst = data.travel.estimated;
      if (data.travel.booked !== undefined) update.travelBooked = data.travel.booked;
      if (data.travel.note !== undefined) update.travelNote = data.travel.note;
    }
    if (data.gear) {
      update.gear = data.gear.amount;
      if (data.gear.note !== undefined) update.gearNote = data.gear.note;
    }
    if (data.food) {
      update.food = data.food.amount;
      if (data.food.note !== undefined) update.foodNote = data.food.note;
    }
    if (data.other) {
      update.other = data.other.amount;
      if (data.other.note !== undefined) update.otherNote = data.other.note;
    }

    // Upsert — create if doesn't exist, update if it does
    const result = await prisma.raceCost.upsert({
      where: { raceSlug: raceId },
      update,
      create: {
        raceSlug: raceId,
        raceName: raceId, // Will be overwritten on next update with proper name
        ...update,
      },
    });

    // Clear race logistics cache so next fetch picks up new costs
    clearCache("race-logistics");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Race cost update error:", error);
    return NextResponse.json(
      { error: "Failed to update race costs", details: String(error) },
      { status: 500 }
    );
  }
}
