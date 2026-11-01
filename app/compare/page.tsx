import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Compare areas" };
export default async function Page() {
  return (
    <Dashboard
      view="compare"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
