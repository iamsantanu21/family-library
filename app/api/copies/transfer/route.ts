import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies, users, transfers } from "@/lib/schema";
import { getHomeLibraryId } from "@/lib/homeLibrary";
import { notifySentToMember } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/copies/transfer
// Body: { copyIds: string[], target: "home" | "<userId>", courier?, tracking?, note? }
//
// Immediate handoff: the copies you currently hold are moved right away to the
// Home Library or to another member, and each move is recorded with its
// sending details (courier / tracking / note).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      copyIds?: string[];
      target?: string;
      courier?: string;
      tracking?: string;
      note?: string;
    };
    const copyIds = Array.isArray(body.copyIds)
      ? body.copyIds.filter(Boolean)
      : [];
    const target = (body.target || "").trim();

    if (copyIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one book to send." },
        { status: 400 }
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: "Choose where to send the books." },
        { status: 400 }
      );
    }

    const homeId = await getHomeLibraryId();
    const toHome = target === "home";

    // Resolve the destination holder.
    let toUserId: string;
    let destName = "";
    let destEmail: string | null = null;
    if (toHome) {
      toUserId = homeId;
    } else {
      const dest = await db.query.users.findFirst({
        where: eq(users.id, target),
      });
      if (!dest || dest.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "That recipient isn't an active member." },
          { status: 400 }
        );
      }
      if (dest.id === user.id) {
        return NextResponse.json(
          { error: "You already hold these books." },
          { status: 400 }
        );
      }
      toUserId = dest.id;
      destName = dest.name;
      destEmail = dest.email;
    }

    // Only copies the sender actually holds, and not already at Home, can move.
    const held = await db
      .select({ id: copies.id })
      .from(copies)
      .where(
        and(
          inArray(copies.id, copyIds),
          eq(copies.holderId, user.id),
          eq(copies.atHome, false)
        )
      );
    const movable = held.map((c) => c.id);
    if (movable.length === 0) {
      return NextResponse.json(
        { error: "None of those books are currently with you to send." },
        { status: 400 }
      );
    }

    const courier = body.courier?.trim() || null;
    const tracking = body.tracking?.trim() || null;
    const note = body.note?.trim() || null;

    // Move the copies, then log a transfer for each.
    await db
      .update(copies)
      .set({
        holderId: toUserId,
        atHome: toHome,
        status: "AVAILABLE",
      })
      .where(inArray(copies.id, movable));

    await db.insert(transfers).values(
      movable.map((copyId) => ({
        copyId,
        fromUserId: user.id,
        toUserId: toHome ? null : toUserId,
        toHome,
        courier,
        tracking,
        note,
      }))
    );

    // Notify the recipient member (best-effort; not for Home Library sends).
    if (!toHome) {
      try {
        const rows = await db.query.copies.findMany({
          where: inArray(copies.id, movable),
          with: { book: true },
        });
        await notifySentToMember(
          new URL(req.url).origin,
          destEmail,
          destName,
          user.name,
          rows.map((r) => r.book.title),
          { courier, tracking, note }
        );
      } catch (e) {
        console.error("notify transfer error", e);
      }
    }

    return NextResponse.json({ ok: true, moved: movable.length });
  } catch (err) {
    console.error("transfer error", err);
    return NextResponse.json(
      { error: "Could not send the books." },
      { status: 500 }
    );
  }
}
