import Link from "next/link";
import { signOut } from "@/auth";
import { requireGrowthUser } from "@/lib/user-access";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireGrowthUser();

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brandmark" href="/">GrowthOS</Link>
        <nav aria-label="Admin navigation">
          <Link href="/">Overview</Link>
          {(user.role === "owner" || user.role === "admin") && <Link href="/users">Users</Link>}
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
    </div>
  );
}
