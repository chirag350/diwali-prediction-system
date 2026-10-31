import ForecastWidget from "../../components/forecast-widget";
import { getSnapshot } from "../../server/forecast";
export const metadata = { title: "Neighborhood forecast widget" };
export default async function Embed() {
  return <ForecastWidget initial={await getSnapshot("2026-during")} />;
}
