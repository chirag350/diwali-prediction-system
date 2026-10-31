import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Data health" };
export default async function Page() {
  return (
    <Dashboard
      view="status"
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}
