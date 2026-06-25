"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function NavAuth() {
  return (
    <>
      <Show when="signed-out">
        <Link href="/login" className="lp-signin">Sign in</Link>
        <Link href="/signup" className="lp-btn lp-btn--sm">Get started →</Link>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className="lp-signin">Dashboard</Link>
        <UserButton />
      </Show>
    </>
  );
}
