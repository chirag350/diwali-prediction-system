import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "How it works" };
export default async function Page() {
  return (
    <Dashboard
      view="about"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
