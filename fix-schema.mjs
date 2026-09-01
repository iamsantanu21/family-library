import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, onnotice: () => {} });
const stmts = [
  `DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ADMIN','MEMBER'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN CREATE TYPE user_status AS ENUM ('PENDING','ACTIVE','REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'MEMBER'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ALTER COLUMN username DROP NOT NULL`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_email_unique') THEN ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email); END IF; END $$`,
  `ALTER TABLE copies ADD COLUMN IF NOT EXISTS at_home boolean NOT NULL DEFAULT false`,
];
for (const s of stmts) { await sql.unsafe(s); }
console.log("Schema updated ✅");
await sql.end();
