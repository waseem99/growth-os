import { desc, eq } from "drizzle-orm";
import { auditLogs, getDatabase, users } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";

export default async function AuditPage() {
  await requirePermission("users:manage");
  const { db, client } = getDatabase();
  try {
    const rows = await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      before: auditLogs.before,
      after: auditLogs.after,
      correlationId: auditLogs.correlationId,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email
    }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).orderBy(desc(auditLogs.createdAt)).limit(250);

    return <main className="shell compact-shell">
      <p className="eyebrow">Operations</p><h1>Audit trail</h1>
      <p>Latest 250 privileged mutations. Secrets and full page bodies are intentionally not recorded.</p>
      <div className="settings-card" style={{ overflowX: "auto" }}>
        <table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th><th>Correlation</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{row.createdAt.toISOString()}</td><td>{row.actorEmail ?? "system/removed user"}</td><td><code>{row.action}</code></td>
            <td>{row.entityType}<br/><code>{row.entityId}</code></td>
            <td><details><summary>View</summary><pre>{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre></details></td>
            <td><code>{row.correlationId ?? "—"}</code></td>
          </tr>)}</tbody>
        </table>
      </div>
    </main>;
  } finally { await client.end(); }
}
