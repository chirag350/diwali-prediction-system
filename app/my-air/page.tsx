import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "My Air" };
export default async function Page() {
  return (
    <Dashboard
      view="my-air"
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}
