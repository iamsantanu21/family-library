import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Don't throw at import time during build; queries will surface the error.
  console.warn("DATABASE_URL is not set.");
}

// Reuse one postgres client across hot reloads / serverless invocations.
const client =
  globalForDb.client ??
  postgres(connectionString ?? "postgres://localhost:5432/postgres", {
    max: 1,
    prepare: false, // friendlier to serverless / connection poolers
  });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
