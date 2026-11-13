import Link from "next/link";
import { requireGrowthUser } from "@/lib/user-access";

export default async function AccessDeniedPage() {
  await requireGrowthUser();
  return <main className="shell compact-shell">
    <section className="settings-card" role="alert" style={{ marginTop: 32 }}>
      <p className="eyebrow">Restricted access</p>
      <h1>You do not have permission to open this page.</h1>
      <p>Your GrowthOS role does not include this operation. Contact an Owner or Admin if your responsibilities have changed.</p>
      <Link href="/">Return to overview</Link>
    </section>
  </main>;
}
