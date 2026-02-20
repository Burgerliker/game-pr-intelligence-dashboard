"use client";

import Link from "next/link";

export function RebuildNav({ title, subtitle, actions = [] }) {
  return (
    <header className="rb-hero">
      <div className="rb-hero-glow" aria-hidden="true" />
      <div className="rb-hero-head">
        <div>
          <p className="rb-kicker">PR Intelligence</p>
          <h1 className="rb-title">{title}</h1>
          {subtitle ? <p className="rb-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className="rb-hero-actions">
        {actions.map((a) =>
          a.href ? (
            <Link key={`${a.label}-${a.href}`} className={`rb-btn ${a.primary ? "rb-btn-primary" : ""}`} href={a.href}>
              {a.label}
            </Link>
          ) : (
            <button key={`${a.label}-btn`} type="button" className={`rb-btn ${a.primary ? "rb-btn-primary" : ""}`} onClick={a.onClick}>
              {a.label}
            </button>
          )
        )}
      </div>
    </header>
  );
}

export function StatusPill({ label, tone = "normal" }) {
  const cls =
    tone === "critical"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warning"
        ? "bg-orange-50 text-orange-700 border-orange-200"
        : tone === "caution"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`rb-chip border ${cls}`}>{label}</span>;
}

export function MetricCard({ label, value, sub }) {
  return (
    <article className="rb-card p-4">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black leading-none tabular-nums md:text-4xl">{value}</p>
      {sub ? <p className="mt-2 text-xs text-slate-500">{sub}</p> : null}
    </article>
  );
}

export function BlockTitle({ title, sub }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-black md:text-xl">{title}</h2>
      {sub ? <p className="mt-1 text-xs text-slate-500 md:text-sm">{sub}</p> : null}
    </div>
  );
}
