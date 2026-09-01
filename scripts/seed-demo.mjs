// Seed 3 demo members with 2 books each, then run EVERY library operation as an
// automated test — replicating exactly what the app's API route handlers do to
// the database — and print a pass/fail log plus a final state summary.
//
// Usage:
//   DATABASE_URL="postgres://…" node scripts/seed-demo.mjs           # seed + test
//   DATABASE_URL="postgres://…" node scripts/seed-demo.mjs cleanup   # remove all demo data
//
// Demo members (password for all: demo1234):
//   alice@demo.local · bob@demo.local · carol@demo.local
// Re-running reseeds cleanly (it removes prior demo data first).
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

const DEMO_EMAIL_LIKE = "%@demo.local";
const DEMO_ISBN_LIKE = "99900000000%";
const MODE = (process.argv[2] || "seed").toLowerCase();

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}`);
  }
}
const step = (t) => console.log(`\n▶ ${t}`);

// ---- helpers that mirror the app ----
async function cleanup() {
  const demo = await sql`select id from users where email like ${DEMO_EMAIL_LIKE}`;
  const ids = demo.map((r) => r.id);
  if (ids.length) {
    await sql`delete from loan_requests where requester_id in ${sql(ids)}`;
    await sql`delete from transfers where from_user_id in ${sql(ids)} or to_user_id in ${sql(ids)}`;
  }
  // Demo books cascade their copies/requests/transfers.
  await sql`delete from books where isbn13 like ${DEMO_ISBN_LIKE}`;
  if (ids.length) {
    await sql`delete from copies where owner_id in ${sql(ids)} or holder_id in ${sql(ids)}`;
    await sql`delete from sessions where user_id in ${sql(ids)}`;
    await sql`delete from reading_logs where user_id in ${sql(ids)}`;
    await sql`delete from users where id in ${sql(ids)}`;
  }
  return ids.length;
}

async function getHomeLibraryId() {
  const found = await sql`select id from users where username='home-library' limit 1`;
  if (found[0]) return found[0].id;
  const id = randomUUID();
  await sql`insert into users (id, username, email, name, role, status, is_system)
            values (${id}, 'home-library', 'home-library@system.local', 'Home Library', 'MEMBER', 'ACTIVE', true)`;
  return id;
}

async function createUser({ username, email, name, location, status }) {
  const id = randomUUID();
  const hash = await bcrypt.hash("demo1234", 10);
  await sql`insert into users (id, email, username, name, location, password_hash, role, status)
            values (${id}, ${email}, ${username}, ${name}, ${location}, ${hash}, 'MEMBER', ${status})`;
  return id;
}

async function addBook(ownerId, b) {
  const bookId = randomUUID();
  await sql`insert into books (id, title, authors, isbn13, publisher, published_date, page_count, categories)
            values (${bookId}, ${b.title}, ${b.authors}, ${b.isbn}, ${b.publisher}, ${b.year}, ${b.pages}, ${b.cat})`;
  const copyId = randomUUID();
  await sql`insert into copies (id, book_id, owner_id, holder_id, status, at_home)
            values (${copyId}, ${bookId}, ${ownerId}, ${ownerId}, 'AVAILABLE', false)`;
  return { bookId, copyId };
}

const copyRow = async (id) =>
  (await sql`select id, book_id, owner_id, holder_id, status, at_home from copies where id=${id}`)[0];
const userRow = async (id) =>
  (await sql`select id, name, role, status from users where id=${id}`)[0];
const reqRow = async (id) =>
  (await sql`select id, copy_id, requester_id, status from loan_requests where id=${id}`)[0];

// ---- API-mirroring operations ----
async function sendHome(copyId, fromId, homeId, details) {
  await sql`update copies set at_home=true, holder_id=${homeId}, status='AVAILABLE' where id=${copyId}`;
  await sql`insert into transfers (id, copy_id, from_user_id, to_user_id, to_home, courier, tracking, note)
            values (${randomUUID()}, ${copyId}, ${fromId}, null, true, ${details.courier}, ${details.tracking}, ${details.note})`;
}
async function sendToMember(copyId, fromId, toId, details) {
  await sql`update copies set at_home=false, holder_id=${toId}, status='AVAILABLE' where id=${copyId}`;
  await sql`insert into transfers (id, copy_id, from_user_id, to_user_id, to_home, courier, tracking, note)
            values (${randomUUID()}, ${copyId}, ${fromId}, ${toId}, false, ${details.courier}, ${details.tracking}, ${details.note})`;
}
async function takeHome(copyId, userId) {
  await sql`update copies set at_home=false, holder_id=${userId}, status='READING' where id=${copyId}`;
}
async function bulkRequest(copyIds, requesterId, message) {
  const ACTIVE = ["PENDING", "APPROVED", "SHIPPED", "RECEIVED"];
  const found = await sql`select id, holder_id from copies where id in ${sql(copyIds)}`;
  const busy = await sql`select copy_id from loan_requests where copy_id in ${sql(copyIds)} and status in ${sql(ACTIVE)}`;
  const busySet = new Set(busy.map((b) => b.copy_id));
  const toCreate = found.filter((c) => c.holder_id !== requesterId && !busySet.has(c.id)).map((c) => c.id);
  const created = [];
  for (const cid of toCreate) {
    const id = randomUUID();
    await sql`insert into loan_requests (id, copy_id, requester_id, status, message)
              values (${id}, ${cid}, ${requesterId}, 'PENDING', ${message})`;
    created.push(id);
  }
  return { created, skipped: copyIds.length - toCreate.length };
}
const approve = (id) => sql`update loan_requests set status='APPROVED' where id=${id}`;
async function ship(id, copyId) {
  await sql`update loan_requests set status='SHIPPED' where id=${id}`;
  await sql`update copies set status='LENT' where id=${copyId}`;
}
async function received(id, copyId, requesterId) {
  await sql`update loan_requests set status='RECEIVED' where id=${id}`;
  await sql`update copies set holder_id=${requesterId}, status='AVAILABLE' where id=${copyId}`;
}
async function returned(id, copyId, ownerId) {
  await sql`update loan_requests set status='RETURNED' where id=${id}`;
  await sql`update copies set holder_id=${ownerId}, status='AVAILABLE' where id=${copyId}`;
}
const cancel = (id) => sql`update loan_requests set status='CANCELLED' where id=${id}`;
const deleteCopy = (id) => sql`delete from copies where id=${id}`;
const deleteTitle = (id) => sql`delete from books where id=${id}`;
// admin/user ops
const approveUser = (id) => sql`update users set status='ACTIVE' where id=${id}`;
const rejectUser = (id) => sql`update users set status='REJECTED' where id=${id}`;
const makeAdmin = (id) => sql`update users set role='ADMIN', status='ACTIVE' where id=${id}`;
const makeMember = (id) => sql`update users set role='MEMBER' where id=${id}`;
async function deleteMember(targetId, homeId) {
  // mirrors app/api/admin/users/[id] deleteMember
  await sql`update copies set owner_id=${homeId} where owner_id=${targetId} and at_home=true`;
  const borrowed = await sql`select id, owner_id from copies where holder_id=${targetId} and owner_id<>${targetId} and at_home=false`;
  for (const b of borrowed) await sql`update copies set holder_id=${b.owner_id}, status='AVAILABLE' where id=${b.id}`;
  await sql`delete from copies where owner_id=${targetId} and at_home=false`;
  await sql`delete from loan_requests where requester_id=${targetId}`;
  await sql`delete from users where id=${targetId}`;
}

async function summary() {
  console.log("\n================ FINAL STATE ================");
  const rows = await sql`
    select b.title, coalesce(h.name, '—') as holder, c.at_home, c.status
    from copies c join books b on b.id=c.book_id
    left join users h on h.id=c.holder_id
    where b.isbn13 like ${DEMO_ISBN_LIKE}
    order by b.title`;
  console.log("Demo copies:");
  for (const r of rows)
    console.log(`  • ${r.title} — held by ${r.at_home ? "🏠 Home Library" : r.holder} (${r.status.toLowerCase()})`);

  const reqs = await sql`
    select b.title, ru.name as requester, lr.status
    from loan_requests lr join copies c on c.id=lr.copy_id
    join books b on b.id=c.book_id join users ru on ru.id=lr.requester_id
    where b.isbn13 like ${DEMO_ISBN_LIKE} order by lr.created_at`;
  console.log("Demo borrow requests:");
  if (!reqs.length) console.log("  (none)");
  for (const r of reqs) console.log(`  • ${r.requester} → “${r.title}” : ${r.status.toLowerCase()}`);

  const trs = await sql`
    select b.title, fu.name as fromn, coalesce(tu.name,'🏠 Home Library') as ton, t.courier, t.tracking, t.note
    from transfers t join copies c on c.id=t.copy_id join books b on b.id=c.book_id
    join users fu on fu.id=t.from_user_id left join users tu on tu.id=t.to_user_id
    where b.isbn13 like ${DEMO_ISBN_LIKE} order by t.created_at`;
  console.log("Recorded transfers (sending details):");
  if (!trs.length) console.log("  (none)");
  for (const t of trs)
    console.log(`  • ${t.fromn} → ${t.ton} : “${t.title}” [${t.courier || "-"} / ${t.tracking || "-"} / ${t.note || "-"}]`);
}

// ---- main ----
try {
  if (MODE === "cleanup") {
    const n = await cleanup();
    console.log(`🧹 Removed demo data (${n} demo user(s) and their demo books).`);
    process.exit(0);
  }

  step("Reset: clearing any previous demo data");
  await cleanup();
  const homeId = await getHomeLibraryId();
  console.log("  home library id:", homeId);

  step("Create 3 demo members (+1 throwaway 'Dave' for the reject/delete test)");
  const alice = await createUser({ username: "alice", email: "alice@demo.local", name: "Alice Sharma", location: "Mumbai", status: "ACTIVE" });
  const bob = await createUser({ username: "bob", email: "bob@demo.local", name: "Bob Rao", location: "Delhi", status: "ACTIVE" });
  const carol = await createUser({ username: "carol", email: "carol@demo.local", name: "Carol Iyer", location: "Bengaluru", status: "PENDING" });
  const dave = await createUser({ username: "dave", email: "dave@demo.local", name: "Dave Fernandes", location: "Goa", status: "PENDING" });
  check("3 members + Dave created", [alice, bob, carol, dave].every(Boolean));

  step("Add 2 books each (6 books, 6 copies)");
  const A1 = await addBook(alice, { title: "Atomic Habits", authors: "James Clear", isbn: "9990000000010", publisher: "Avery", year: "2018", pages: 320, cat: "Self-help" });
  const A2 = await addBook(alice, { title: "Deep Work", authors: "Cal Newport", isbn: "9990000000027", publisher: "Grand Central", year: "2016", pages: 296, cat: "Productivity" });
  const B1 = await addBook(bob, { title: "The Alchemist", authors: "Paulo Coelho", isbn: "9990000000034", publisher: "HarperOne", year: "1988", pages: 208, cat: "Fiction" });
  const B2 = await addBook(bob, { title: "Sapiens", authors: "Yuval Noah Harari", isbn: "9990000000041", publisher: "Harper", year: "2011", pages: 443, cat: "History" });
  const C1 = await addBook(carol, { title: "The Pragmatic Programmer", authors: "Hunt & Thomas", isbn: "9990000000058", publisher: "Addison-Wesley", year: "1999", pages: 352, cat: "Programming" });
  const C2 = await addBook(carol, { title: "Clean Code", authors: "Robert C. Martin", isbn: "9990000000065", publisher: "Prentice Hall", year: "2008", pages: 464, cat: "Programming" });
  const nBooks = (await sql`select count(*)::int n from books where isbn13 like ${DEMO_ISBN_LIKE}`)[0].n;
  const nCopies = (await sql`select count(*)::int n from copies c join books b on b.id=c.book_id where b.isbn13 like ${DEMO_ISBN_LIKE}`)[0].n;
  check("6 demo books exist", nBooks === 6);
  check("6 demo copies exist", nCopies === 6);

  step("Admin: approve Carol (PENDING → ACTIVE)");
  await approveUser(carol);
  check("Carol is ACTIVE", (await userRow(carol)).status === "ACTIVE");

  step("Admin: reject then delete throwaway member Dave");
  await rejectUser(dave);
  check("Dave is REJECTED", (await userRow(dave)).status === "REJECTED");
  await deleteMember(dave, homeId);
  check("Dave deleted", !(await userRow(dave)));

  step("Admin: role toggle on Bob (make admin, then back to member)");
  await makeAdmin(bob);
  check("Bob is ADMIN", (await userRow(bob)).role === "ADMIN");
  await makeMember(bob);
  check("Bob is MEMBER again", (await userRow(bob)).role === "MEMBER");

  step("Send to Home Library: Alice ships 'Atomic Habits' to the shelf (with courier/tracking/note)");
  await sendHome(A1.copyId, alice, homeId, { courier: "BlueDart", tracking: "BD-1001", note: "Donating to the family shelf" });
  let a1 = await copyRow(A1.copyId);
  check("Atomic Habits is at_home & held by Home Library", a1.at_home === true && a1.holder_id === homeId);

  step("Send to a member: Bob sends 'The Alchemist' to Carol (with details)");
  await sendToMember(B1.copyId, bob, carol, { courier: "India Post", tracking: "IP-2002", note: "You will love this one" });
  check("The Alchemist now held by Carol", (await copyRow(B1.copyId)).holder_id === carol);

  step("Take from Home Library: Carol takes 'Atomic Habits'");
  await takeHome(A1.copyId, carol);
  a1 = await copyRow(A1.copyId);
  check("Atomic Habits now held by Carol, not at home", a1.holder_id === carol && a1.at_home === false);

  step("Bulk borrow request #1: Alice requests BOTH of Carol's own books (Pragmatic + Clean Code) at once");
  const r1 = await bulkRequest([C1.copyId, C2.copyId], alice, "Could you send these two when free?");
  check("2 requests created in one call", r1.created.length === 2 && r1.skipped === 0);

  step("Bulk borrow request #2: Alice requests Bob's 'Sapiens'");
  const r2 = await bulkRequest([B2.copyId], alice, "Keen to read Sapiens");
  check("1 request created", r2.created.length === 1);
  const reqSapiens = r2.created[0];

  step("Dedup guard: Alice re-requests 'Sapiens' (already pending) — should be skipped");
  const r3 = await bulkRequest([B2.copyId], alice, "again");
  check("duplicate request skipped", r3.created.length === 0 && r3.skipped === 1);

  step("Borrow handshake on 'Sapiens': Bob approves → ships → Alice receives");
  await approve(reqSapiens);
  check("request APPROVED", (await reqRow(reqSapiens)).status === "APPROVED");
  await ship(reqSapiens, B2.copyId);
  check("request SHIPPED & copy LENT", (await reqRow(reqSapiens)).status === "SHIPPED" && (await copyRow(B2.copyId)).status === "LENT");
  await received(reqSapiens, B2.copyId, alice);
  let b2 = await copyRow(B2.copyId);
  check("request RECEIVED & Sapiens now held by Alice", (await reqRow(reqSapiens)).status === "RECEIVED" && b2.holder_id === alice);

  step("Return 'Sapiens': goes back to owner Bob");
  await returned(reqSapiens, B2.copyId, bob);
  b2 = await copyRow(B2.copyId);
  check("request RETURNED & Sapiens back with Bob", (await reqRow(reqSapiens)).status === "RETURNED" && b2.holder_id === bob);

  step("Cancel a pending request: Alice cancels her request for 'Clean Code'");
  const cleanReq = (await sql`select lr.id from loan_requests lr where lr.copy_id=${C2.copyId} and lr.requester_id=${alice} order by lr.created_at desc limit 1`)[0].id;
  await cancel(cleanReq);
  check("Clean Code request CANCELLED", (await reqRow(cleanReq)).status === "CANCELLED");

  step("Delete a copy (owner): Alice deletes her 'Deep Work' copy");
  await deleteCopy(A2.copyId);
  check("Deep Work copy gone", !(await copyRow(A2.copyId)));

  step("Delete a whole title with cascade (admin): remove 'The Alchemist' (held by Carol, has a transfer)");
  await deleteTitle(B1.bookId);
  check("Alchemist book gone", !(await sql`select id from books where id=${B1.bookId}`)[0]);
  check("Alchemist copy cascade-deleted", !(await copyRow(B1.copyId)));
  check("Alchemist transfer cascade-deleted", (await sql`select count(*)::int n from transfers where copy_id=${B1.copyId}`)[0].n === 0);

  await summary();
  console.log(`\n================ RESULT: ${pass} passed, ${fail} failed ================`);
  console.log("Demo logins (password: demo1234): alice@demo.local, bob@demo.local, carol@demo.local");
  console.log("To remove all of this later:  node scripts/seed-demo.mjs cleanup");
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("\n💥 Error:", e.message);
  process.exit(1);
} finally {
  await sql.end().catch(() => {});
}
