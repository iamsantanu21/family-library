import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies, loanRequests } from "@/lib/schema";

export const dynamic = "force-dynamic";

const ACTIVE = ["PENDING", "APPROVED", "SHIPPED", "RECEIVED"] as const;

// POST -> ask to borrow one or more copies.
//   { copyId, message? }             single copy (back-compat)
//   { copyIds: string[], message? }  several at once
// Copies you already hold, or that already have an active request, are skipped.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      copyId?: string;
      copyIds?: string[];
      message?: string;
    };

    const ids = (
      Array.isArray(body.copyIds) ? body.copyIds : body.copyId ? [body.copyId] : []
    ).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one book to request." },
        { status: 400 }
      );
    }

    const message = body.message ? String(body.message) : null;

    // The copies that actually exist and aren't already with the requester.
    const found = await db
      .select({ id: copies.id, holderId: copies.holderId })
      .from(copies)
      .where(inArray(copies.id, ids));

    // Copies that already have an active request.
    const busy = await db
      .select({ copyId: loanRequests.copyId })
      .from(loanRequests)
      .where(
        and(
          inArray(loanRequests.copyId, ids),
          inArray(loanRequests.status, [...ACTIVE])
        )
      );
    const busySet = new Set(busy.map((b) => b.copyId));

    const toCreate = found
      .filter((c) => c.holderId !== user.id && !busySet.has(c.id))
      .map((c) => c.id);

    if (toCreate.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nothing to request — those books are already with you or already requested.",
        },
        { status: 409 }
      );
    }

    await db.insert(loanRequests).values(
      toCreate.map((copyId) => ({
        copyId,
        requesterId: user.id,
        message,
      }))
    );

    return NextResponse.json({
      ok: true,
      requested: toCreate.length,
      skipped: ids.length - toCreate.length,
    });
  } catch (err) {
    console.error("create request error", err);
    return NextResponse.json(
      { error: "Could not send request." },
      { status: 500 }
    );
  }
}
