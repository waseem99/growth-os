import { asc } from "drizzle-orm";
import { getDatabase, users } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { createAllowedUser, updateAllowedUser } from "./actions";

export default async function UsersPage() {
  const actor = await requirePermission("users:manage");
  const { db, client } = getDatabase();
  const rows = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
    .from(users).orderBy(asc(users.email)).finally(async () => client.end());

  return (
    <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Access control</p><h1>Internal users</h1><p>Only listed active emails can authenticate. Role checks also run server-side for privileged mutations.</p></section>
      <form className="inline-form" action={createAllowedUser}>
        <input aria-label="Email" name="email" type="email" placeholder="team@company.com" required />
        <select aria-label="Role" name="role" defaultValue="editor">
          {actor.role === "owner" && <option value="owner">Owner</option>}
          <option value="admin">Admin</option><option value="editor">Editor</option><option value="analyst">Analyst</option>
        </select>
        <button className="primary-button" type="submit">Allow email</button>
      </form>
      <div className="table-list">
        {rows.map((user) => (
          <form className="user-row" action={updateAllowedUser} key={user.id}>
            <input type="hidden" name="id" value={user.id} />
            <div><strong>{user.email}</strong><span>{user.name ?? "Pending first sign-in"}</span></div>
            <select name="role" defaultValue={user.role} aria-label={`Role for ${user.email}`}>
              {actor.role === "owner" && <option value="owner">Owner</option>}
              <option value="admin">Admin</option><option value="editor">Editor</option><option value="analyst">Analyst</option>
            </select>
            <select name="status" defaultValue={user.status} aria-label={`Status for ${user.email}`}>
              <option value="active">Active</option><option value="disabled">Disabled</option>
            </select>
            <button type="submit">Save</button>
          </form>
        ))}
      </div>
    </main>
  );
}
