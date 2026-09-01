"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  approve: "Approve",
  reject: "Turn off access",
  makeAdmin: "Make admin",
  makeMember: "Make normal",
  delete: "Delete",
};

export default function AdminUserActions({
  userId,
  actions,
}: {
  userId: string;
  actions: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: string) {
    // Two-step confirm for destructive delete.
    if (action === "delete" && confirming !== "delete") {
      setConfirming("delete");
      return;
    }
    setBusy(action);
    setConfirming(null);
    setMsg(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.refresh();
    else setMsg(data.error || "Failed.");
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a}
          onClick={() => run(a)}
          disabled={!!busy}
          className={
            a === "delete"
              ? "rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              : a === "reject" || a === "makeMember"
              ? "btn-ghost text-xs"
              : "btn text-xs"
          }
        >
          {busy === a
            ? "…"
            : a === "delete" && confirming === "delete"
            ? "Really delete?"
            : LABELS[a] || a}
        </button>
      ))}
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
