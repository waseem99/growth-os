import { eq } from "drizzle-orm";
import { getDatabase, users } from "@growth-os/db";

const userProjection = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status
};

export async function findAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  const { db, client } = getDatabase();
  try {
    const [user] = await db.select(userProjection).from(users).where(eq(users.email, normalized)).limit(1);
    return user ?? null;
  } finally {
    await client.end();
  }
}

export async function ensureBootstrapOwner(email: string) {
  const normalized = email.trim().toLowerCase();
  const { db, client } = getDatabase();
  try {
    const [existing] = await db.select(userProjection).from(users).where(eq(users.email, normalized)).limit(1);
    if (existing) return existing;

    const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
    if (anyUser) return null;

    const [created] = await db.insert(users).values({
      email: normalized,
      name: "GrowthOS Owner",
      role: "owner",
      status: "active"
    }).returning(userProjection);

    return created ?? null;
  } finally {
    await client.end();
  }
}
