import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Understand the why" };
export default async function Page() {
  return (
    <Dashboard
      view="why"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
