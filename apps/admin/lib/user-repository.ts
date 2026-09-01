import { eq } from "drizzle-orm";
import { getDatabase, users } from "@growth-os/db";

export async function findAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  const { db, client } = getDatabase();
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status
    }).from(users).where(eq(users.email, normalized)).limit(1);
    return user ?? null;
  } finally {
    await client.end();
  }
}
