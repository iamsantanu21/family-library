import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, copies } from "@/lib/schema";
import MyBooksManager, {
  type HeldItem,
  type MemberOption,
} from "@/components/MyBooksManager";

export const dynamic = "force-dynamic";

export default async function MyBooksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Books I'm physically holding right now (not the ones sitting in the Home Library).
  const held = await db.query.copies.findMany({
    where: and(eq(copies.holderId, user.id), eq(copies.atHome, false)),
    with: { book: true },
    orderBy: desc(copies.createdAt),
  });

  // Active members I can send to (excludes me and the Home Library system account).
  const members = await db.query.users.findMany({
    where: and(eq(users.isSystem, false), eq(users.status, "ACTIVE")),
    orderBy: asc(users.name),
  });

  const items: HeldItem[] = held.map((c) => ({
    copyId: c.id,
    bookId: c.bookId,
    title: c.book.title,
    authors: c.book.authors,
    coverUrl: c.book.coverUrl,
    status: c.status,
    borrowed: c.ownerId !== user.id,
  }));

  const memberOptions: MemberOption[] = members
    .filter((m) => m.id !== user.id)
    .map((m) => ({ id: m.id, name: m.name, location: m.location }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My books 📕</h1>
        <p className="text-sm text-slate-500">
          Everything currently with you. Pick one or more, then send them to the
          Home Library or to another family member.
        </p>
      </div>

      <MyBooksManager items={items} members={memberOptions} />
    </div>
  );
}
