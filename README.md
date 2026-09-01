# 📚 Family Library

A shared library web app for a family spread across different cities. Everyone
adds the books they buy, and the app keeps track of **what we own, who has each
copy, where it is, who has read it, and who wants to borrow it** — so nobody
accidentally buys the same book twice.

**🌐 Live app:** https://family-library-ten.vercel.app

Add a book by **scanning its barcode**, **snapping the cover** (AI reads the
title & author), or **searching by name** — every field stays editable before
you save.

---

## ✨ Features

- **Sign in with Google or email + password.** New members need the family
  invite code, then wait for an admin to approve them.
- **Add a book 3 ways** — 📷 barcode scan → ISBN lookup, 🖼️ cover photo → AI
  identification, or 🔎 search by title/author. Details auto-fill and stay fully
  editable.
- **No duplicates** — when you add (or before you buy) the app warns you if the
  title is already on the family shelf and tells you who has it.
- **Catalog with filters** — search every title the family owns, and switch
  between **All books**, **With me**, **With others**, and **🏠 Home Library**
  to see exactly where things are.
- **Who has what, where** — each physical copy shows its current holder and
  their city. Members show how many books they're holding.
- **My Books — bulk send** — a page listing everything currently with you.
  Tick one or several and **send them in one go** to the Home Library or to
  another member, with **sending details** (courier, tracking number, a note).
  The handoff is immediate — the recipient becomes the new holder right away and
  the details are saved to the book's history.
- **🏠 Home Library** — a shared shelf. Add a book (you hold it), read it, then
  **Send it to the Home Library** when you ship it to the family shelf. Anyone
  can **Take from Home Library** into their own collection. The dashboard shows
  what's currently there.
- **Delete books** — the owner (or an admin) can remove a single copy; an admin
  can delete a whole title and all its copies from the catalog.
- **⭐ Wishlist** — add books the family would *like* to have. Everyone sees
  what's wanted (and by whom) before buying, and any wish that's already on the
  shelf is flagged "owned" with who holds it — so you fill gaps instead of
  double-buying.
- **Request badge** — the nav shows a count on **Requests** whenever something is
  waiting on you: a borrow to approve or send, or an incoming book to confirm.
- **📧 Email notifications** (optional) — when set up with a Resend key, the app
  emails people on the moments that matter: a borrow request comes in, a request
  is approved / sent / returned, a book is sent straight to you, or a new
  wishlist item is added. Leave the key unset and the app just sends nothing.
- **Borrow / exchange** — ask to borrow a copy from whoever holds it; the holder
  approves and sends; you confirm you received it; mark it returned when it goes
  back.
- **Browse a member & bulk-request** — open any member from the **Members** page
  to see everything they're currently holding, then tick one or several of their
  books and send all the borrow requests at once (with an optional message).
- **Reading log** — mark books as want-to-read / reading / finished, rate them,
  and see who else has read them.
- **👑 Admin** — approve new members, change roles (admin ↔ normal), and remove
  accounts.

---

## 🧱 Tech

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | **Next.js 14** (App Router, React, TypeScript)     |
| Database   | **PostgreSQL** via **Drizzle ORM** (no binary engine) |
| Styling    | **Tailwind CSS**                                   |
| Auth       | Cookie sessions (bcrypt) + **Google OAuth**        |
| Scanning   | **@zxing** in-browser barcode reader               |
| Book data  | **Google Books API** (free, no key needed)         |
| Cover AI   | **Anthropic** or **OpenAI** vision (optional)      |
| Hosting    | **Vercel** (Hobby / free tier)                     |

The app is environment-agnostic — it reads its own URL from the incoming
request, so it runs on the live domain, a preview URL, or localhost with no code
changes.

---

## 🚀 Run it locally

**1. Get a Postgres database.** Free option: [Neon](https://neon.tech) — create a
project and copy the connection string. (Supabase works too.)

**2. Configure environment variables:**

```bash
cp .env.example .env
```

Open `.env` and set at least `DATABASE_URL`. See the table below.

**3. Install, create tables, run:**

```bash
npm install
npm run db:push     # creates all tables in your database
npm run dev         # http://localhost:3000
```

Open the app, click **Join**, and create the first account (the first member
becomes the admin automatically).

---

## ☁️ Deploy to Vercel (free)

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com): **Add New → Project** → import the repo.
3. Add the environment variables (below) in **Settings → Environment Variables**.
4. Deploy. Vercel gives you a URL and auto-redeploys on every push to `main`.
5. First time only: run `npm run db:push` locally against the same
   `DATABASE_URL` so the production database has the tables.
6. After pulling updates that change the schema, apply them to the live
   database. For the sending/transfers feature:

   ```bash
   DATABASE_URL="postgres://…" node scripts/add-transfers.mjs
   DATABASE_URL="postgres://…" node scripts/add-wishlist.mjs
   ```

   (Both are idempotent — safe to run more than once.)

---

## 🔑 Environment variables

| Variable                     | Required | What it's for                                                        |
| ---------------------------- | :------: | -------------------------------------------------------------------- |
| `DATABASE_URL`               |   ✅     | Postgres connection string.                                          |
| `FAMILY_INVITE_CODE`         |   ➖     | Code new members must enter to sign up. Blank = open sign-up.        |
| `GOOGLE_CLIENT_ID`           |   ➖     | Google OAuth client ID (for "Continue with Google").                 |
| `GOOGLE_CLIENT_SECRET`       |   ➖     | Google OAuth client secret.                                          |
| `NEXT_PUBLIC_GOOGLE_ENABLED` |   ➖     | Set to `true` to show the Google sign-in button.                     |
| `VISION_PROVIDER`            |   ➖     | `anthropic` or `openai` for cover-photo AI.                          |
| `ANTHROPIC_API_KEY`          |   ➖     | Needed if `VISION_PROVIDER=anthropic`.                               |
| `OPENAI_API_KEY`             |   ➖     | Needed if `VISION_PROVIDER=openai`.                                  |
| `RESEND_API_KEY`             |   ➖     | Enables email notifications (via [Resend](https://resend.com)).      |
| `EMAIL_FROM`                 |   ➖     | Sender for those emails, e.g. `Family Library <you@yourdomain.com>`. |

Only `DATABASE_URL` is required — barcode scanning, ISBN and name search all work
without any keys. Add the Google and vision keys to enable those extras.

### Setting up Google sign-in

Create an **OAuth client (Web application)** at
[Google Cloud Console](https://console.cloud.google.com) → *APIs & Services →
Credentials*, and add these **authorised redirect URIs**:

```
https://YOUR-APP.vercel.app/api/auth/google/callback
http://localhost:3000/api/auth/google/callback
```

While the Google app is in "testing" mode, only emails added as **test users**
(in the OAuth consent screen) can use the Google button — everyone else signs in
with email + password.

### Setting up email notifications

1. Create a free account at [resend.com](https://resend.com) and copy an **API
   key** (API Keys → Create).
2. Add `RESEND_API_KEY` to your environment variables (Vercel → Settings →
   Environment Variables), then redeploy.
3. **Sender address:** to email the whole family, verify a domain you own in
   Resend (Domains → Add) and set `EMAIL_FROM` to an address at that domain
   (e.g. `Family Library <library@yourdomain.com>`). Until you verify a domain,
   the default test sender `onboarding@resend.dev` only delivers to the email on
   your own Resend account — fine for trying it out.

Emails are sent for: a borrow request received, a request approved / sent /
returned, a book sent straight to a member, and a new wishlist item. Members
only get emails if their account has an email address.

---

## 👑 Members, roles & approval

- The **first person to register becomes the admin** and is active immediately.
- Everyone after them needs the invite code, then starts as **pending** until the
  admin approves them from the **Admin** page.
- The admin can **approve**, **turn off access**, **make admin / make normal**,
  and **delete** members.
- Deleting a member keeps any books they'd shifted to the Home Library and
  removes the rest.

**Promote an account to admin manually** (e.g. if the auto-admin didn't apply):

```bash
DATABASE_URL="postgres://…" node scripts/make-admin.mjs you@email.com
```

---

## 🔁 How borrowing works

1. Someone taps **Ask to borrow** on a copy → the holder sees it under
   *Requests → Waiting for you*.
2. Holder taps **Approve**, then **Mark as sent**.
3. Borrower taps **I got it** → they become the copy's new holder (the catalog
   now shows the book is with them, in their city).
4. When it goes back, either person taps **Mark returned** → it returns to the
   owner.

The **owner** never changes (whoever bought it). The **holder** changes as the
book travels — that's how the app always knows where a book physically is. A book
can also live at the **🏠 Home Library** instead of with a person.

### Sending books (My Books)

Borrowing is a *request* flow (ask → approve → receive). **Sending** is the
direct flow: on the **My Books** page you pick books you already hold and hand
them off immediately — to the Home Library or to any active member. You can
attach a **courier**, **tracking number**, and a **note**; each send is recorded
in the `transfers` table and shown on the book's page as its latest handoff.

---

## 🗂️ Project structure

```
app/
  api/                 auth (email + Google), book lookup, books, copies,
                       requests, reading, admin
  admin/               admin page: approve / roles / delete members
  add/                 add-a-book screen (barcode / photo / search)
  books/[id]/          book detail: copies, holders, borrow, home library, delete
  catalog/             searchable family catalog with All/Mine/Others/Home tabs
  my-books/            books with you — multi-select + bulk send with details
  wishlist/            books the family wants (with already-owned detection)
  requests/            incoming + outgoing borrow requests
  members/             who's in the library and how much they hold
  members/[id]/        one member's shelf + multi-select bulk borrow requests
  reading/             your reading list
components/             small client widgets
lib/
  schema.ts            database tables (Drizzle) incl. transfers log
  db.ts                database connection
  auth.ts              passwords + login sessions
  books.ts             Google Books + Open Library lookup, vision-AI cover reading
  homeLibrary.ts       the shared Home Library account
scripts/
  make-admin.mjs       promote a user to admin
  add-transfers.mjs    create the transfers table (idempotent)
  add-wishlist.mjs     create the wishlist table (idempotent)
  seed-demo.mjs        seed 3 demo members + books and self-test every operation
drizzle/               generated SQL migrations
```

---

## 🔒 Notes

- Passwords are hashed (bcrypt); logins use secure http-only cookie sessions.
- Book cover images are loaded from Google Books by URL, so nothing large is
  stored in the database.
- Change the family invite code any time in your environment variables.
