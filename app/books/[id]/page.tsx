import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, asc, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, copies, loanRequests } from "@/lib/schema";
import BorrowButton from "@/components/BorrowButton";
import ReadingControls from "@/components/ReadingControls";
import CopyActionButton from "@/components/CopyActionButton";

export const dynamic = "force-dynamic";

const ACTIVE = ["PENDING", "APPROVED", "SHIPPED", "RECEIVED"] as const;

export default async function BookPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const book = await db.query.books.findFirst({
    where: eq(books.id, params.id),
    with: {
      copies: {
        orderBy: asc(copies.createdAt),
        with: {
          owner: true,
          holder: true,
          requests: {
            where: inArray(loanRequests.status, [...ACTIVE]),
            with: { requester: true },
          },
        },
      },
      readingLogs: { with: { user: true } },
    },
  });
  if (!book) notFound();

  const myLog = book.readingLogs.find((l) => l.userId === user.id);

  return (
    <div className="space-y-8">
      <Link href="/catalog" className="text-sm text-brand-600">
        ← Back to catalog
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverUrl || "/book-placeholder.svg"}
          alt=""
          className="h-56 w-40 flex-shrink-0 self-center rounded-lg object-cover shadow sm:self-start"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
          {book.authors && <p className="text-slate-600">by {book.authors}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {book.publisher && <span>{book.publisher}</span>}
            {book.publishedDate && <span>{book.publishedDate}</span>}
            {book.pageCount ? <span>{book.pageCount} pages</span> : null}
            {book.isbn13 && <span>ISBN {book.isbn13}</span>}
            {book.categories && <span>{book.categories}</span>}
          </div>
          {book.description && (
            <p className="pt-2 text-sm leading-relaxed text-slate-700">
              {book.description}
            </p>
          )}
        </div>
      </div>

      {/* Copies */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Copies ({book.copies.length})
        </h2>
        <div className="space-y-2">
          {book.copies.map((c) => {
            const activeReq = c.requests[0];
            const iHold = c.holderId === user.id && !c.atHome;
            const iRequested = activeReq?.requesterId === user.id;
            return (
              <div
                key={c.id}
                className="card flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {c.atHome ? (
                      <span className="font-medium">🏠 Home Library</span>
                    ) : (
                      <>
                        <span className="font-medium">{c.holder.name}</span>
                        {c.holder.location && (
                          <span className="text-slate-500">
                            {" "}
                            · {c.holder.location}
                          </span>
                        )}
                        <span className="text-slate-400">
                          {" "}
                          has it{c.ownerId !== c.holderId ? " (borrowed)" : ""}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Added by {c.owner.name}
                    {c.condition ? ` · ${c.condition}` : ""}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </div>
                </div>

                {c.atHome ? (
                  <span className="badge bg-emerald-100 text-emerald-700">
                    in home library
                  </span>
                ) : (
                  <StatusBadge status={c.status} />
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {c.atHome ? (
                    <CopyActionButton
                      copyId={c.id}
                      action="takeHome"
                      label="Take from Home Library"
                    />
                  ) : activeReq ? (
                    <span className="text-xs text-slate-500">
                      {iRequested ? "You" : activeReq.requester.name} requested ·{" "}
                      {activeReq.status.toLowerCase()}
                    </span>
                  ) : iHold ? (
                    <>
                      <CopyActionButton
                        copyId={c.id}
                        action={c.status === "READING" ? "available" : "reading"}
                        label={
                          c.status === "READING"
                            ? "Mark available"
                            : "I'm reading this"
                        }
                        ghost
                      />
                      <CopyActionButton
                        copyId={c.id}
                        action="sendHome"
                        label="🏠 Send to Home Library"
                        ghost
                      />
                    </>
                  ) : (
                    <BorrowButton copyId={c.id} />
                  )}
                </div>
              </div>
            );
          })}
          {book.copies.length === 0 && (
            <p className="text-sm text-slate-500">No copies recorded.</p>
          )}
        </div>
      </section>

      {/* Reading */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold">Your reading</h3>
          <ReadingControls
            bookId={book.id}
            currentStatus={myLog?.status}
            currentRating={myLog?.rating}
          />
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold">Who&apos;s read this</h3>
          {book.readingLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No one has logged it yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {book.readingLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span>{l.user.name}</span>
                  <span className="text-slate-500">
                    {l.status === "FINISHED"
                      ? `finished${l.rating ? ` · ${"★".repeat(l.rating)}` : ""}`
                      : l.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700",
    LENT: "bg-amber-100 text-amber-800",
    READING: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`badge ${map[status] || "bg-slate-100 text-slate-600"}`}>
      {status.toLowerCase()}
    </span>
  );
}
