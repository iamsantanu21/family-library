"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    username: "",
    location: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create account.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Join the family library 📚</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create your account so you can add books and borrow.
      </p>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label">Your name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={form.username}
            onChange={set("username")}
            autoComplete="username"
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
