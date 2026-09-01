import Link from "next/link";
import { signOut } from "@/auth";
import { hasPermission } from "@/lib/authz";
import { requireGrowthUser } from "@/lib/user-access";
import { AssetPickerBridge } from "./asset-picker-bridge";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireGrowthUser();
  const isAdmin = user.role === "owner" || user.role === "admin";
  const canManageCampaigns = hasPermission(user.role, "campaigns:manage");
  const canManageIntegrations = hasPermission(user.role, "integrations:manage");

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brandmark" href="/">GrowthOS</Link>
        <nav aria-label="Admin navigation">
          <Link href="/">Overview</Link>
          <Link href="/pages">Landing Pages</Link>
          {canManageCampaigns && <Link href="/campaigns">Campaigns</Link>}
          <Link href="/assets">Asset Library</Link>
          {isAdmin && <Link href="/brands">Brands</Link>}
          {canManageIntegrations && <Link href="/integrations">Integrations</Link>}
          {isAdmin && <Link href="/users">Users</Link>}
        </nav>
        <form action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}>
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <div className="user-strip"><span>{user.email}</span><strong>{user.role}</strong></div>
      {children}
      <AssetPickerBridge />
    </div>
  );
}
