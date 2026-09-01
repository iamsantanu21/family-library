"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CopyActionButton({
  copyId,
  action,
  label,
  ghost,
}: {
  copyId: string;
  action: "reading" | "available" | "sendHome" | "takeHome";
  label: string;
  ghost?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/copies", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ copyId, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.refresh();
    else setMsg(data.error || "Failed.");
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className={ghost ? "btn-ghost text-xs" : "btn text-xs"}
      >
        {busy ? "…" : label}
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </span>
  );
}
