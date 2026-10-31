import Dashboard from "../components/dashboard";
import { getSnapshot, registry } from "../server/forecast";
export default async function Home() {
  const snapshot = await getSnapshot("2026-during");
  return <Dashboard initial={snapshot} registry={registry} />;
}
