import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, copies } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const members = await db.query.users.findMany({
    where: eq(users.isSystem, false),
    orderBy: asc(users.name),
    with: {
      ownedCopies: { columns: { id: true } },
      heldCopies: {
        with: { book: true },
        orderBy: desc(copies.createdAt),
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Family members 👨‍👩‍👧‍👦</h1>
        <p className="text-sm text-slate-500">
          Who&apos;s in the library, where they are, and what&apos;s on their shelf
          right now.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div key={m.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={m.id === user.id ? "/my-books" : `/members/${m.id}`}
                  className="font-medium hover:text-brand-700"
                >
                  {m.name}
                </Link>
                {m.id === user.id && (
                  <span className="ml-1 text-xs text-brand-600">(you)</span>
                )}
                <div className="text-xs text-slate-500">
                  {m.location || "location not set"} · holds{" "}
                  <strong>{m.heldCopies.length}</strong> · owns{" "}
                  {m.ownedCopies.length}
                </div>
              </div>
              <Link
                href={m.id === user.id ? "/my-books" : `/members/${m.id}`}
                className="whitespace-nowrap text-xs text-brand-600 hover:underline"
              >
                {m.id === user.id ? "My books →" : "Books & borrow →"}
              </Link>
            </div>
            {m.heldCopies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {m.heldCopies.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={`/books/${c.bookId}`}
                    className="badge bg-slate-100 text-slate-600 hover:bg-slate-200"
                    title={c.book.title}
                  >
                    {c.book.title.length > 22
                      ? c.book.title.slice(0, 22) + "…"
                      : c.book.title}
                  </Link>
                ))}
                {m.heldCopies.length > 8 && (
                  <span className="badge bg-slate-50 text-slate-400">
                    +{m.heldCopies.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
