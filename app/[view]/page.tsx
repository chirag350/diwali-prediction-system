import { Suspense } from "react";
import Loading from "../loading";
import Dashboard from "../../components/dashboard";
import { getSnapshot, registry } from "../../server/forecast";
import { notFound } from "next/navigation";
const views = [
  "map",
  "my-air",
  "time-machine",
  "why",
  "lab",
  "compare",
  "report-card",
  "authority",
  "report",
  "pledge",
  "about",
  "status",
];
export function generateStaticParams() {
  return views.map((view) => ({ view }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return {
    title:
      (
        {
          "my-air": "My Air",
          "time-machine": "Time Machine",
          "report-card": "Model Report Card",
          why: "Understand the Why",
          lab: "What-if Lab",
          authority: "City Desk",
          about: "Our Methodology",
          status: "Data Health",
          report: "Community",
        } as Record<string, string>
      )[view] ?? view.replaceAll("-", " "),
  };
}
async function ViewContent({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!views.includes(view)) notFound();
  return (
    <Dashboard
      view={view}
      initial={await getSnapshot("2025-during")}
      registry={registry}
    />
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <ViewContent params={params} />
    </Suspense>
  );
}
