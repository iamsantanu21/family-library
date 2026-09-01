# 📚 Family Library

A small web app so a family spread across different cities can share one library.
Everyone adds the books they buy, and the app keeps track of **what we own, who
has each copy, where it is, who has read it, and who wants to borrow it** — so no
one accidentally buys the same book twice.

Add a book by **scanning its barcode**, **snapping the cover** (AI reads the
title/author), or **searching by name** — every field stays editable before you
save.

---

## 🆕 In this version

- **Sign in with Google or email + password.** (Google needs a Google Cloud
  OAuth client — set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  `NEXT_PUBLIC_GOOGLE_ENABLED=true`. Without them, email/password still works.)
- **Home Library 🏠** — a shared shelf. Add a book (you hold it), read it, then
  tap **Send to Home Library** when you ship it to the family shelf. Anyone can
  **Take from Home Library**. The dashboard shows what's currently there.
- **Admin controls** — approve members, **make admin / make normal**, and
  **delete** accounts. Deleting a member keeps their Home-Library books and
  removes the rest.
- **Held counts** — every member shows how many books they're holding.

## ✨ What it does

- **Accounts** — everyone gets a username + password. An optional family invite
  code keeps strangers out.
- **Add a book 3 ways** — barcode scan (camera) → ISBN lookup, cover photo → AI
  identification, or plain text search. Details auto-fill and are fully editable.
- **No duplicates** — when you add (or before you buy) the app warns you if the
  title is already on the family shelf, and tells you who has it.
- **Catalog** — search every title the family owns, see how many copies exist and
  which are available.
- **Who has what, where** — each physical copy shows its current holder and their
  city.
- **Borrow / exchange** — ask to borrow a copy; the holder approves and marks it
  sent; you confirm you received it (it becomes yours to hold); mark it returned
  when you send it back.
- **Reading log** — mark books as want-to-read / reading / finished, rate them,
  and see who else has read them.

---

## 🧱 Tech

- **Next.js 14** (App Router, React, TypeScript) — one app for UI + API
- **Drizzle ORM** + **PostgreSQL** — data (no binary engines; deploys anywhere)
- **Tailwind CSS** — styling
- **@zxing** — in-browser barcode scanning
- **Anthropic / OpenAI vision** (optional) — read a cover photo into book details
- **Google Books API** — free book metadata (no key needed)

---

## 🚀 Quick start (run it on your computer)

**1. Get a free Postgres database.** Easiest is [Neon](https://neon.tech) — make a
project and copy the connection string. (Supabase works too.)

**2. Set up environment variables.** Copy the example and fill it in:

```bash
cp .env.example .env
```

Open `.env` and set at least `DATABASE_URL`. (Vision AI is optional — see below.)

**3. Install and create the tables:**

```bash
npm install
npm run db:push        # creates all tables in your database
```

**4. Run it:**

```bash
npm run dev
```

Open http://localhost:3000, click **Join**, and create the first account (use your
`FAMILY_INVITE_CODE` if you set one). You're in. 🎉

---

## ☁️ Put it on the internet for free (Vercel)

1. Push this folder to a **GitHub** repo.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. In the project's **Settings → Environment Variables**, add the same values from
   your `.env` (`DATABASE_URL`, `FAMILY_INVITE_CODE`, and the AI keys if you use
   them).
4. Deploy. Vercel gives you a URL like `your-library.vercel.app` — share it with
   the family.
5. First time only: run `npm run db:push` locally (pointing at the same
   `DATABASE_URL`) so the production database has the tables. (Neon's free tier is
   reachable from your laptop and from Vercel.)

> Tip: Neon has a one-click **Vercel integration** that sets `DATABASE_URL` for you.

---

## 🤖 Turning on "photo of the cover → auto-fill" (optional)

The barcode scanner and ISBN/name lookup work **without any API key**. To also
identify a book from a **photo of its front cover**, add an AI key:

- Set `VISION_PROVIDER="anthropic"` and `ANTHROPIC_API_KEY=...`
  (get one at https://console.anthropic.com), **or**
- Set `VISION_PROVIDER="openai"` and `OPENAI_API_KEY=...`

If no key is present, the app simply skips AI and lets you type the details — every
field is editable anyway.

---

## 👑 Members & admin approval

- The **first person to register becomes the admin** and is active right away.
- Everyone after them needs the **family invite code** to sign up, and then
  starts as **pending** — they can't log in until the admin approves them.
- The admin gets an **Admin** page (top nav) listing everyone waiting, with
  **Approve**, **Turn off access**, and **Make admin** buttons.
- Already created an account before this feature existed? Promote it once with:
  `DATABASE_URL="postgres://…" node scripts/make-admin.mjs <your-username>`

## 🔁 How borrowing works (the states)

1. Someone taps **Ask to borrow** on a copy → the holder sees it under
   *Requests → Waiting for you*.
2. Holder taps **Approve** and then **Mark as sent** (post/hand it over).
3. Borrower taps **I got it** → they become the copy's new holder (the catalog now
   shows the book is with them, in their city).
4. When it goes back, either person taps **Mark returned** → it returns to the
   owner.

The **owner** never changes (whoever bought it). The **holder** changes as the book
travels — that's how the app always knows where a book physically is.

---

## 🗂️ Project layout

```
app/                Next.js pages + API routes
  api/              auth, book lookup (isbn + vision), books, copies, requests, reading
  add/              add-a-book screen (barcode / photo / search)
  books/[id]/       book detail: copies, holders, borrow, reading
  catalog/          searchable family catalog
  requests/         incoming + outgoing borrow requests
  members/          who's in the library and what they hold
  reading/          your reading list
components/          small client widgets (borrow, request actions, reading, etc.)
lib/
  schema.ts         database tables (Drizzle)
  db.ts             database connection
  auth.ts           passwords + login sessions
  books.ts          Google Books lookup + vision-AI cover reading
drizzle/            generated SQL migration
```

---

## 🔒 Notes

- Passwords are hashed (bcrypt); logins use secure http-only cookie sessions.
- The family invite code is the simple gate for who can join — change it any time
  in your environment variables.
- Book cover images are loaded from Google Books by URL, so nothing large is stored
  in your database.
