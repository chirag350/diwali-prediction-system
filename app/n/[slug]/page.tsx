import { Suspense } from "react";
import Loading from "../../loading";
import { notFound } from "next/navigation";
import Dashboard from "../../../components/dashboard";
import { getSnapshot, registry } from "../../../server/forecast";
const slug = (name: string, id: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${id}`;
export async function generateStaticParams() {
  const snapshot = await getSnapshot("2025-during");
  return snapshot.stations.map((s) => ({ slug: slug(s.name, s.id) }));
}
async function NeighborhoodContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: requested } = await params;
  const snapshot = await getSnapshot("2025-during");
  const station = snapshot.stations.find(
    (s) => slug(s.name, s.id) === requested,
  );
  if (!station) notFound();
  return (
    <Dashboard
      view="my-air"
      initial={snapshot}
      registry={registry}
      initialStation={station.id}
    />
  );
}

export default function Neighborhood({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <NeighborhoodContent params={params} />
    </Suspense>
  );
}
