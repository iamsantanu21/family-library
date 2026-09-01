import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingLogs } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function ReadingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const logs = await db.query.readingLogs.findMany({
    where: eq(readingLogs.userId, user.id),
    with: { book: true },
    orderBy: desc(readingLogs.updatedAt),
  });

  const groups = [
    { key: "READING", label: "Reading now" },
    { key: "WANT", label: "Want to read" },
    { key: "FINISHED", label: "Finished" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My reading 📖</h1>
      {logs.length === 0 && (
        <p className="text-sm text-slate-500">
          Nothing logged yet. Open a book and set its reading status.
        </p>
      )}
      {groups.map((g) => {
        const items = logs.filter((l) => l.status === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-3 text-lg font-semibold">
              {g.label}{" "}
              <span className="text-sm font-normal text-slate-400">
                ({items.length})
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((l) => (
                <Link
                  key={l.id}
                  href={`/books/${l.bookId}`}
                  className="card flex gap-3 hover:border-brand-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.book.coverUrl || "/book-placeholder.svg"}
                    alt=""
                    className="h-16 w-11 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.book.title}</div>
                    <div className="truncate text-xs text-slate-500">
                      {l.book.authors}
                    </div>
                    {l.status === "FINISHED" && l.rating ? (
                      <div className="text-xs text-amber-500">
                        {"★".repeat(l.rating)}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
