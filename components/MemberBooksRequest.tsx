"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type MemberCopy = {
  copyId: string;
  bookId: string;
  title: string;
  authors: string | null;
  coverUrl: string | null;
  status: string;
  // Why a copy can't be requested (null = you can request it).
  blocked: "mine" | "requested" | null;
  requestedBy: string | null; // who has the active request, if any
};

export default function MemberBooksRequest({
  memberName,
  items,
}: {
  memberName: string;
  items: MemberCopy[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const requestable = items.filter((i) => i.blocked === null);
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );
  const allChecked =
    requestable.length > 0 && selectedIds.length === requestable.length;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleAll() {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(requestable.map((i) => [i.copyId, true])));
  }

  async function request() {
    setErr(null);
    setMsg(null);
    if (selectedIds.length === 0) {
      setErr("Tick at least one book to request.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ copyIds: selectedIds, message }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(
        `Sent ${data.requested} request${data.requested === 1 ? "" : "s"} to ${memberName}.` +
          (data.skipped ? ` (${data.skipped} skipped)` : "")
      );
      setSelected({});
      setMessage("");
      router.refresh();
    } else {
      setErr(data.error || "Could not send.");
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {memberName} isn&apos;t holding any books right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {requestable.length > 0 && (
        <div className="flex items-center justify-between">
          <button onClick={toggleAll} className="btn-ghost text-xs">
            {allChecked ? "Clear selection" : "Select all"}
          </button>
          <span className="text-xs text-slate-500">
            {selectedIds.length} selected
          </span>
        </div>
      )}

      <div className="space-y-2">
        {items.map((it) => {
          const disabled = it.blocked !== null;
          return (
            <label
              key={it.copyId}
              className={`card flex items-center gap-3 ${
                disabled
                  ? "opacity-70"
                  : selected[it.copyId]
                  ? "cursor-pointer border-brand-400 bg-brand-50"
                  : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!selected[it.copyId]}
                onChange={() => toggle(it.copyId)}
                className="h-4 w-4 flex-shrink-0"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.coverUrl || "/book-placeholder.svg"}
                alt=""
                className="h-14 w-10 flex-shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/books/${it.bookId}`}
                  className="truncate text-sm font-medium hover:text-brand-700"
                >
                  {it.title}
                </Link>
                <div className="truncate text-xs text-slate-500">{it.authors}</div>
                <div className="mt-1 flex gap-1">
                  <span className="badge bg-slate-100 text-slate-600">
                    {it.status.toLowerCase()}
                  </span>
                  {it.blocked === "mine" && (
                    <span className="badge bg-slate-100 text-slate-500">
                      you own this
                    </span>
                  )}
                  {it.blocked === "requested" && (
                    <span className="badge bg-amber-100 text-amber-800">
                      already requested
                      {it.requestedBy ? ` · ${it.requestedBy}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {requestable.length > 0 && (
        <div className="card space-y-3">
          <div className="font-medium">Ask to borrow selected</div>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">
              Message to {memberName} (optional)
            </span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. could you send these when you get a chance?"
              className="input"
            />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={request} disabled={busy} className="btn">
              {busy ? "Sending…" : `Request ${selectedIds.length || ""} →`}
            </button>
            {msg && <span className="text-xs text-green-700">{msg}</span>}
            {err && <span className="text-xs text-red-600">{err}</span>}
          </div>
          <p className="text-xs text-slate-400">
            {memberName} sees each request and can approve and send. You confirm
            when it arrives, and you become the book&apos;s holder.
          </p>
        </div>
      )}
    </div>
  );
}
