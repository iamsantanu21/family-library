// Promote a user to ADMIN + ACTIVE (handy if the first-signup auto-admin didn't apply).
// Usage:
//   DATABASE_URL="postgres://..." node scripts/make-admin.mjs you@email.com
// You can pass an email or a username. With no argument, the earliest real
// (non-system) member is promoted.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });
const who = process.argv[2]?.toLowerCase();

try {
  let rows;
  if (who && who.includes("@")) {
    rows = await sql`update users set role='ADMIN', status='ACTIVE'
                     where email=${who} returning name, email, role, status`;
  } else if (who) {
    rows = await sql`update users set role='ADMIN', status='ACTIVE'
                     where username=${who} returning name, username, role, status`;
  } else {
    rows = await sql`update users set role='ADMIN', status='ACTIVE'
                     where id = (select id from users where is_system=false
                                 order by created_at asc limit 1)
                     returning name, email, role, status`;
  }
  if (rows.length === 0) console.log("No matching user found.");
  else console.log("✅ Promoted:", rows[0]);
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
