import Link from "next/link";
import { Brand } from "../components/ui";
export default function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>Check the address or go to the home page.</p>
      <Link className="primary-button" href="/">
        Go to home ↗
      </Link>
    </main>
  );
}
