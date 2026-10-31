import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Community" };
export default async function Page() {
  return (
    <Dashboard
      view="report"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
