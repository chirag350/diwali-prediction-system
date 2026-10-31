import { ArrowUpRight, Info } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "orange";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
export function CardHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="info-note">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
export function ArrowLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small-brand" : ""}`}>
      <svg
        width="34"
        height="38"
        viewBox="0 0 34 38"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 25C6 12 17 17 17 3C29 15 25 28 15 29"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M4 30C12 20 24 30 30 19M9 35C15 29 22 35 28 29"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </svg>
      <span>
        shwāsa<span className="brand-ai">AIR, UNDERSTOOD.</span>
      </span>
    </span>
  );
}
