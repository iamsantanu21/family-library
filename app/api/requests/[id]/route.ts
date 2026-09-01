import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies, loanRequests, requestStatus } from "@/lib/schema";

export const dynamic = "force-dynamic";

type Action = "approve" | "decline" | "ship" | "received" | "returned" | "cancel";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = (await req.json()) as { action: Action };

  const request = await db.query.loanRequests.findFirst({
    where: eq(loanRequests.id, params.id),
    with: { copy: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const copy = request.copy;
  const isHolder = copy.holderId === user.id;
  const isRequester = request.requesterId === user.id;
  const isOwner = copy.ownerId === user.id;

  const setStatus = (status: (typeof requestStatus.enumValues)[number]) =>
    db.update(loanRequests).set({ status }).where(eq(loanRequests.id, request.id));

  try {
    switch (action) {
      case "approve":
        assert(isHolder && request.status === "PENDING", "Only the holder can approve a pending request.");
        await setStatus("APPROVED");
        break;

      case "decline":
        assert(isHolder && ["PENDING", "APPROVED"].includes(request.status), "Only the holder can decline.");
        await setStatus("DECLINED");
        break;

      case "ship":
        assert(isHolder && ["APPROVED", "PENDING"].includes(request.status), "Only the holder can mark as sent.");
        await db.transaction(async (tx) => {
          await tx.update(loanRequests).set({ status: "SHIPPED" }).where(eq(loanRequests.id, request.id));
          await tx.update(copies).set({ status: "LENT" }).where(eq(copies.id, copy.id));
        });
        break;

      case "received":
        assert(isRequester && ["SHIPPED", "APPROVED"].includes(request.status), "Only the borrower can confirm they received it.");
        await db.transaction(async (tx) => {
          await tx.update(loanRequests).set({ status: "RECEIVED" }).where(eq(loanRequests.id, request.id));
          await tx
            .update(copies)
            .set({ holderId: request.requesterId, status: "AVAILABLE" })
            .where(eq(copies.id, copy.id));
        });
        break;

      case "returned":
        assert(
          (isRequester || isOwner || isHolder) && ["RECEIVED", "SHIPPED"].includes(request.status),
          "Only the borrower or owner can mark it returned."
        );
        await db.transaction(async (tx) => {
          await tx.update(loanRequests).set({ status: "RETURNED" }).where(eq(loanRequests.id, request.id));
          await tx
            .update(copies)
            .set({ holderId: copy.ownerId, status: "AVAILABLE" })
            .where(eq(copies.id, copy.id));
        });
        break;

      case "cancel":
        assert(isRequester && ["PENDING", "APPROVED"].includes(request.status), "Only the requester can cancel.");
        await setStatus("CANCELLED");
        break;

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.message?.startsWith("ASSERT:")) {
      return NextResponse.json(
        { error: err.message.replace("ASSERT:", "") },
        { status: 403 }
      );
    }
    console.error("update request error", err);
    return NextResponse.json({ error: "Could not update request." }, { status: 500 });
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT:" + msg);
}
