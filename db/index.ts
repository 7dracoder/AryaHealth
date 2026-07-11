import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { ensureDatabase, getD1 } from "./runtime";

export function getDb() {
  return drizzle(getD1(), { schema });
}

export async function getReadyDb() {
  await ensureDatabase();
  return getDb();
}
