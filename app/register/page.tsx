"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    location: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.pending) {
        setPending(true);
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      setError(data.error || "Could not create account.");
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <div className="card space-y-3">
          <div className="text-4xl">🕓</div>
          <h1 className="text-xl font-bold">Almost there!</h1>
          <p className="text-sm text-slate-600">
            Your account was created and is <strong>waiting for the family
            admin to approve it</strong>. You&apos;ll be able to log in once
            they do.
          </p>
          <Link href="/login" className="btn w-full">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Join the family library 📚</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create your account so you can add books and borrow.
      </p>

      {GOOGLE_ENABLED && (
        <>
          <a href="/api/auth/google" className="btn-ghost mb-4 w-full">
            Continue with Google
          </a>
          <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or{" "}
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label">Your name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label">Where you live (city)</label>
          <input
            className="input"
            value={form.location}
            onChange={set("location")}
            placeholder="e.g. Kolkata"
          />
          <p className="mt-1 text-xs text-slate-400">
            So everyone knows where a book physically is.
          </p>
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="label">Family invite code</label>
          <input
            className="input"
            value={form.inviteCode}
            onChange={set("inviteCode")}
            placeholder="Ask whoever set up the library"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-brand-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
