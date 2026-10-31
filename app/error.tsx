"use client";
import Link from "next/link";
import { Brand } from "../components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <Brand />
      <span className="eyebrow">A MOMENT TO CATCH OUR BREATH</span>
      <h1>This view couldn’t load.</h1>
      <p>
        Your archived forecasts are still available. Try loading this page
        again.
      </p>
      <button className="primary-button" onClick={reset}>
        Try again ↗
      </button>
      <Link href="/">Back to the overview</Link>
    </main>
  );
}
