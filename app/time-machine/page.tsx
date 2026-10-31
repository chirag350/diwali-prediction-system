import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Time Machine" };
export default async function Page() {
  return (
    <Dashboard
      view="time-machine"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
