import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, copies, loanRequests } from "@/lib/schema";
import { getHomeLibraryId } from "@/lib/homeLibrary";

export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "makeAdmin" | "makeMember" | "delete";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { action } = (await req.json()) as { action: Action };

  const target = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.isSystem) {
    return NextResponse.json(
      { error: "The Home Library account can't be changed." },
      { status: 400 }
    );
  }
  if (target.id === me.id) {
    return NextResponse.json(
      { error: "You can't change your own account here." },
      { status: 400 }
    );
  }

  switch (action) {
    case "approve":
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, target.id));
      break;
    case "reject":
      await db.update(users).set({ status: "REJECTED" }).where(eq(users.id, target.id));
      break;
    case "makeAdmin":
      await db
        .update(users)
        .set({ role: "ADMIN", status: "ACTIVE" })
        .where(eq(users.id, target.id));
      break;
    case "makeMember":
      await db.update(users).set({ role: "MEMBER" }).where(eq(users.id, target.id));
      break;
    case "delete":
      await deleteMember(target.id);
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Delete a member. Books already shifted to the Home Library are kept there;
// books still owned by the member are removed; books they borrowed go back to
// their owners.
async function deleteMember(targetId: string) {
  const homeId = await getHomeLibraryId();

  // 1. Books they own that are already in the Home Library → keep (reassign owner).
  await db
    .update(copies)
    .set({ ownerId: homeId })
    .where(and(eq(copies.ownerId, targetId), eq(copies.atHome, true)));

  // 2. Books they borrowed from someone else → return to the owner.
  const borrowed = await db
    .select({ id: copies.id, ownerId: copies.ownerId })
    .from(copies)
    .where(
      and(
        eq(copies.holderId, targetId),
        ne(copies.ownerId, targetId),
        eq(copies.atHome, false)
      )
    );
  for (const b of borrowed) {
    await db
      .update(copies)
      .set({ holderId: b.ownerId, status: "AVAILABLE" })
      .where(eq(copies.id, b.id));
  }

  // 3. Books they own that are NOT in the Home Library → delete (cascades requests).
  await db
    .delete(copies)
    .where(and(eq(copies.ownerId, targetId), eq(copies.atHome, false)));

  // 4. Remove any borrow requests they made.
  await db.delete(loanRequests).where(eq(loanRequests.requesterId, targetId));

  // 5. Finally delete the account (sessions + reading logs cascade).
  await db.delete(users).where(eq(users.id, targetId));
}
