import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingLogs } from "@/lib/schema";

export const dynamic = "force-dynamic";

// POST { bookId, status: WANT|READING|FINISHED, rating?, review? } -> upsert.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { bookId, status, rating, review } = await req.json();
    if (!bookId || !status) {
      return NextResponse.json(
        { error: "bookId and status required." },
        { status: 400 }
      );
    }
    if (!["WANT", "READING", "FINISHED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const finishedAt = status === "FINISHED" ? new Date() : null;
    const ratingVal = rating ? Number(rating) : null;

    await db
      .insert(readingLogs)
      .values({
        userId: user.id,
        bookId,
        status,
        rating: ratingVal,
        review: review || null,
        finishedAt,
      })
      .onConflictDoUpdate({
        target: [readingLogs.userId, readingLogs.bookId],
        set: { status, rating: ratingVal, review: review || null, finishedAt },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reading log error", err);
    return NextResponse.json(
      { error: "Could not update reading status." },
      { status: 500 }
    );
  }
}
