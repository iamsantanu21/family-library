import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import AdminUserActions from "@/components/AdminUserActions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") redirect("/");

  const all = await db.query.users.findMany({
    where: eq(users.isSystem, false),
    orderBy: asc(users.createdAt),
  });

  const pending = all.filter((u) => u.status === "PENDING");
  const active = all.filter((u) => u.status === "ACTIVE");
  const rejected = all.filter((u) => u.status === "REJECTED");

  function Row({ u, actions }: { u: (typeof all)[number]; actions: string[] }) {
    const isMe = u.id === me!.id;
    return (
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {u.name}
            {isMe && <span className="ml-1 text-xs text-brand-600">(you)</span>}
            {u.role === "ADMIN" && (
              <span className="badge ml-2 bg-brand-100 text-brand-700">
                👑 admin
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {u.email || u.username || "—"}
            {u.location ? ` · ${u.location}` : ""}
          </div>
        </div>
        {isMe ? (
          <span className="text-xs text-slate-400">that&apos;s you</span>
        ) : (
          <AdminUserActions userId={u.id} actions={actions} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin 👑</h1>
        <p className="text-sm text-slate-500">
          Approve members, change roles, and manage access.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Waiting for approval{" "}
          <span className="text-sm font-normal text-slate-400">
            ({pending.length})
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No one is waiting right now. 🎉</p>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <Row key={u.id} u={u} actions={["approve", "reject", "delete"]} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Active members{" "}
          <span className="text-sm font-normal text-slate-400">
            ({active.length})
          </span>
        </h2>
        <div className="space-y-2">
          {active.map((u) => (
            <Row
              key={u.id}
              u={u}
              actions={
                u.role === "ADMIN"
                  ? ["makeMember", "delete"]
                  : ["makeAdmin", "reject", "delete"]
              }
            />
          ))}
        </div>
      </section>

      {rejected.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Turned off{" "}
            <span className="text-sm font-normal text-slate-400">
              ({rejected.length})
            </span>
          </h2>
          <div className="space-y-2">
            {rejected.map((u) => (
              <Row key={u.id} u={u} actions={["approve", "delete"]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
