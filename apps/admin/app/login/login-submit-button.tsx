"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button login-submit" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          Signing in…
        </>
      ) : "Sign in"}
    </button>
  );
}
