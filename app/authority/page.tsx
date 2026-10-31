import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "City desk" };
export default async function Page() {
  return (
    <Dashboard
      view="authority"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
