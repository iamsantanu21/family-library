import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, copies, loanRequests } from "@/lib/schema";
import MemberBooksRequest, {
  type MemberCopy,
} from "@/components/MemberBooksRequest";

export const dynamic = "force-dynamic";

const ACTIVE = ["PENDING", "APPROVED", "SHIPPED", "RECEIVED"] as const;

export default async function MemberPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  // Viewing your own page? Send to My Books, where you manage your own shelf.
  if (params.id === me.id) redirect("/my-books");

  const member = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  if (!member) notFound();

  const held = await db.query.copies.findMany({
    where: and(eq(copies.holderId, member.id), eq(copies.atHome, false)),
    with: {
      book: true,
      requests: {
        where: inArray(loanRequests.status, [...ACTIVE]),
        with: { requester: true },
      },
    },
    orderBy: desc(copies.createdAt),
  });

  const items: MemberCopy[] = held.map((c) => {
    const active = c.requests[0];
    const blocked: MemberCopy["blocked"] =
      c.ownerId === me.id ? "mine" : active ? "requested" : null;
    return {
      copyId: c.id,
      bookId: c.bookId,
      title: c.book.title,
      authors: c.book.authors,
      coverUrl: c.book.coverUrl,
      status: c.status,
      blocked,
      requestedBy: active
        ? active.requesterId === me.id
          ? "you"
          : active.requester.name
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/members" className="text-sm text-brand-600">
        ← All members
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {member.isSystem ? "🏠 " : ""}
          {member.name}
        </h1>
        <p className="text-sm text-slate-500">
          {member.location || "location not set"} · holding{" "}
          <strong>{held.length}</strong> book{held.length === 1 ? "" : "s"} right
          now
        </p>
      </div>

      {member.isSystem ? (
        <p className="text-sm text-slate-500">
          These books are in the shared shelf. Open any one and use{" "}
          <strong>Take from Home Library</strong> to bring it into your
          collection.{" "}
          <Link href="/catalog?view=home" className="text-brand-600">
            View the Home Library →
          </Link>
        </p>
      ) : (
        <MemberBooksRequest memberName={member.name} items={items} />
      )}
    </div>
  );
}
