import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Explore the map" };
export default async function Page() {
  return (
    <Dashboard
      view="map"
      initial={await getSnapshot("2026-during")}
      registry={registry}
    />
  );
}
