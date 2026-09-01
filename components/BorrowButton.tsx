"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BorrowButton({ copyId }: { copyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ copyId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg("Request sent ✅");
      router.refresh();
    } else {
      setMsg(data.error || "Could not send request.");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn-ghost text-xs" onClick={ask} disabled={busy}>
        {busy ? "Sending…" : "Ask to borrow"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
