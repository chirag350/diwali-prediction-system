import Link from "next/link";
import { Brand } from "../components/ui";
export default function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <span className="eyebrow">A LITTLE OFF THE MAP</span>
      <h1>Let’s find your way back.</h1>
      <p>This page isn’t here. Your neighborhood forecast is.</p>
      <Link className="primary-button" href="/">
        Back to your air ↗
      </Link>
    </main>
  );
}
