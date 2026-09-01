"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  approve: "Approve",
  decline: "Decline",
  ship: "Mark as sent",
  received: "I got it",
  returned: "Mark returned",
  cancel: "Cancel",
};

export default function RequestActions({
  requestId,
  actions,
}: {
  requestId: string;
  actions: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setMsg(null);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.refresh();
    } else {
      setMsg(data.error || "Failed.");
    }
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
            a === "decline" || a === "cancel"
              ? "btn-ghost text-xs"
              : "btn text-xs"
          }
        >
          {busy === a ? "…" : LABELS[a] || a}
        </button>
      ))}
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
