import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { LoginSubmitButton } from "./login-submit-button";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email && session.user.status === "active") redirect("/");

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-copy">
          <p className="eyebrow">GrowthOS</p>
          <h1>Welcome back.</h1>
          <p>Sign in with your internal GrowthOS account. There is no public account registration.</p>
        </div>

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
            <input name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" placeholder="••••••••••••" required />
          </label>
          <LoginSubmitButton />
          <p className="login-help">You’ll be taken straight to the GrowthOS overview after sign-in.</p>
        </form>

        {googleEnabled ? (
          <details className="login-alt">
            <summary>Other sign-in option</summary>
            <form action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}>
              <button className="secondary-button" type="submit">Continue with Google</button>
            </form>
          </details>
        ) : null}
      </section>
    </main>
  );
}
