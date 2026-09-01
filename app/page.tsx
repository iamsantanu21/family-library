import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc, inArray, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, copies, loanRequests, readingLogs, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

const ACTIVE = ["PENDING", "APPROVED", "SHIPPED"] as const;

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [
    titleCount,
    myCopies,
    holding,
    incomingRows,
    outgoingRows,
    readingCount,
    homeCopies,
  ] = await Promise.all([
    db.$count(books),
    db.$count(copies, eq(copies.ownerId, user.id)),
    db.query.copies.findMany({
      where: eq(copies.holderId, user.id),
      with: { book: true },
      orderBy: desc(copies.createdAt),
    }),
    db
      .select({ value: count() })
      .from(loanRequests)
      .innerJoin(copies, eq(loanRequests.copyId, copies.id))
      .where(
        and(
          eq(copies.holderId, user.id),
          inArray(loanRequests.status, [...ACTIVE])
        )
      ),
    db
      .select({ value: count() })
      .from(loanRequests)
      .where(
        and(
          eq(loanRequests.requesterId, user.id),
          inArray(loanRequests.status, [...ACTIVE])
        )
      ),
    db.$count(
      readingLogs,
      and(eq(readingLogs.userId, user.id), eq(readingLogs.status, "READING"))
    ),
    db.query.copies.findMany({
      where: eq(copies.atHome, true),
      with: { book: true },
      orderBy: desc(copies.createdAt),
    }),
  ]);

  const incoming = incomingRows[0]?.value ?? 0;
  const outgoing = outgoingRows[0]?.value ?? 0;

  const pendingApprovals =
    user.role === "ADMIN"
      ? await db.$count(users, eq(users.status, "PENDING"))
      : 0;

  const stats = [
    { label: "Titles in the library", value: titleCount, href: "/catalog" },
    { label: "🏠 In Home Library", value: homeCopies.length, href: "/catalog" },
    { label: "Books with you now", value: holding.length, href: "/" },
    { label: "You're reading", value: readingCount, href: "/reading" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-slate-500">
          Here&apos;s what&apos;s happening on the family shelf.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-brand-300">
            <div className="text-2xl font-bold text-brand-700">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>

      {pendingApprovals > 0 && (
        <Link
          href="/admin"
          className="block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          👑 {pendingApprovals} new member(s) waiting for your approval →
        </Link>
      )}

      {(incoming > 0 || outgoing > 0) && (
        <div className="flex flex-wrap gap-3">
          {incoming > 0 && (
            <Link href="/requests" className="badge bg-amber-100 text-amber-800">
              {incoming} request(s) waiting for you →
            </Link>
          )}
          {outgoing > 0 && (
            <Link href="/requests" className="badge bg-blue-100 text-blue-800">
              {outgoing} of your requests in progress →
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/add" className="btn">
          ➕ Add a book you bought
        </Link>
        <Link href="/catalog" className="btn-ghost">
          🔎 Search the catalog before buying
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Books with you right now</h2>
        {holding.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing on your shelf yet. Add a book you own, or borrow one from the
            catalog.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {holding.map((c) => (
              <Link
                key={c.id}
                href={`/books/${c.bookId}`}
                className="card flex gap-3 hover:border-brand-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.book.coverUrl || "/book-placeholder.svg"}
                  alt=""
                  className="h-20 w-14 flex-shrink-0 rounded object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.book.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {c.book.authors}
                  </div>
                  <div className="mt-1 text-xs">
                    {c.ownerId === user.id ? (
                      <span className="text-slate-400">Your own copy</span>
                    ) : (
                      <span className="text-amber-700">Borrowed</span>
                    )}{" "}
                    · {c.status.toLowerCase()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">🏠 In the Home Library</h2>
        {homeCopies.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing in the Home Library yet. When someone finishes a book and
            ships it to the family shelf, it&apos;ll appear here for anyone to
            take.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {homeCopies.map((c) => (
              <Link
                key={c.id}
                href={`/books/${c.bookId}`}
                className="card flex gap-3 hover:border-brand-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.book.coverUrl || "/book-placeholder.svg"}
                  alt=""
                  className="h-20 w-14 flex-shrink-0 rounded object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.book.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {c.book.authors}
                  </div>
                  <div className="mt-1 text-xs text-emerald-600">
                    available to take
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
