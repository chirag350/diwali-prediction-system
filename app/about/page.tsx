import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Our methodology" };
export default async function Page() {
  return (
    <Dashboard
      view="about"
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}
