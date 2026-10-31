import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "What-if Lab" };
export default async function Page() {
  return (
    <Dashboard
      view="lab"
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}
