import Link from "next/link";
import { redirect } from "next/navigation";
import { or, eq, inArray, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies, loanRequests } from "@/lib/schema";
import RequestActions from "@/components/RequestActions";

export const dynamic = "force-dynamic";

function allowedActions(
  status: string,
  roles: { isRequester: boolean; isHolder: boolean; isOwner: boolean }
) {
  const a: string[] = [];
  const { isRequester, isHolder, isOwner } = roles;
  if (isHolder && status === "PENDING") a.push("approve");
  if (isHolder && (status === "PENDING" || status === "APPROVED"))
    a.push("ship", "decline");
  if (isRequester && (status === "SHIPPED" || status === "APPROVED"))
    a.push("received");
  if (
    (isRequester || isOwner || isHolder) &&
    (status === "RECEIVED" || status === "SHIPPED")
  )
    a.push("returned");
  if (isRequester && (status === "PENDING" || status === "APPROVED"))
    a.push("cancel");
  return Array.from(new Set(a));
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  RECEIVED: "bg-green-100 text-green-700",
  RETURNED: "bg-slate-100 text-slate-600",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Copies I own or currently hold — requests on these concern me.
  const myCopies = await db
    .select({ id: copies.id })
    .from(copies)
    .where(or(eq(copies.ownerId, user.id), eq(copies.holderId, user.id)));
  const myCopyIds = myCopies.map((c) => c.id);

  const all = await db.query.loanRequests.findMany({
    where: or(
      eq(loanRequests.requesterId, user.id),
      myCopyIds.length ? inArray(loanRequests.copyId, myCopyIds) : undefined
    ),
    with: {
      requester: true,
      copy: { with: { book: true, owner: true, holder: true } },
    },
    orderBy: desc(loanRequests.updatedAt),
  });

  const incoming = all.filter((r) => r.requesterId !== user.id);
  const outgoing = all.filter((r) => r.requesterId === user.id);

  function Row({ r }: { r: (typeof all)[number] }) {
    const roles = {
      isRequester: r.requesterId === user!.id,
      isHolder: r.copy.holderId === user!.id,
      isOwner: r.copy.ownerId === user!.id,
    };
    const actions = allowedActions(r.status, roles);
    return (
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={r.copy.book.coverUrl || "/book-placeholder.svg"}
          alt=""
          className="h-16 w-11 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/books/${r.copy.bookId}`}
            className="font-medium hover:underline"
          >
            {r.copy.book.title}
          </Link>
          <div className="text-xs text-slate-500">
            {roles.isRequester ? (
              <>You asked {r.copy.holder.name}</>
            ) : (
              <>
                {r.requester.name} asked to borrow from {r.copy.holder.name}
              </>
            )}
          </div>
        </div>
        <span className={`badge ${STATUS_COLOR[r.status]}`}>
          {r.status.toLowerCase()}
        </span>
        {actions.length > 0 && (
          <RequestActions requestId={r.id} actions={actions} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Borrow requests 🔁</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Waiting for you{" "}
          <span className="text-sm font-normal text-slate-400">
            (books people want from you)
          </span>
        </h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing right now.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-slate-500">
            You haven&apos;t asked to borrow anything yet.{" "}
            <Link href="/catalog" className="text-brand-600">
              Browse the catalog →
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
