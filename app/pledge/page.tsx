import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
export const metadata = { title: "Clean Diwali pledge" };
export default async function Page() {
  return (
    <Dashboard
      view="pledge"
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}
