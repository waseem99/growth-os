import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email && session.user.status === "active") redirect("/");

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">GrowthOS · Internal</p>
        <h1>Sign in to continue.</h1>
        <p>Access is restricted to the configured internal administrator and approved team accounts. There is no public account registration.</p>

        <form className="credentials-form" action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/"
          });
        }}>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary-button" type="submit">Sign in</button>
        </form>

        {googleEnabled ? (
          <>
            <div className="login-divider"><span>or</span></div>
            <form action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}>
              <button className="secondary-button" type="submit">Continue with Google</button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
