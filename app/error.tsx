"use client";
import Link from "next/link";
import { Brand } from "../components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <Brand />
      <span className="eyebrow">PAGE ERROR</span>
      <h1>This page could not load</h1>
      <p>Please try again.</p>
      <button className="primary-button" onClick={reset}>
        Try again ↗
      </button>
      <Link href="/">Back to the overview</Link>
    </main>
  );
}
