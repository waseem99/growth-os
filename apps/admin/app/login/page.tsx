import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email && session.user.status === "active") redirect("/");

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">GrowthOS · Internal</p>
        <h1>Sign in to continue.</h1>
        <p>Access is restricted to pre-approved team email addresses. There is no public account registration.</p>
        <form action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}>
          <button className="primary-button" type="submit">Continue with Google</button>
        </form>
      </section>
    </main>
  );
}
