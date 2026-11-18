import type { Metadata } from "next";
import { experiment } from "@/config/funnel";
import { dailyLeads, experimentStats, overview, recentLeads } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Funnel dashboard", robots: { index: false } };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function Admin() {
  const o = overview();
  const variants = experimentStats();
  const daily = dailyLeads(30);
  const max = Math.max(1, ...daily.map((d) => d.n));
  const leads = recentLeads(50);

  return (
    <div className="admin">
      <h1>Funnel dashboard</h1>
      <p className="meta">
        Current experiment: <code>{experiment.id}</code> · <a className="btn" href="/admin/leads.csv">Export all leads (CSV)</a>
      </p>

      <div className="tiles">
        <Tile label="Total leads" value={o.totalLeads} />
        <Tile label="Last 24 hours" value={o.leads24h} />
        <Tile label="Gave a phone number" value={o.withPhone} />
        <Tile label="Emails not delivered" value={o.emailFailed} />
      </div>

      <h2>A/B test: conversion by variant</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Variant</th>
              <th>Headline</th>
              <th>Visitors</th>
              <th>Leads</th>
              <th>Conversion</th>
              <th>Lift vs A</th>
              <th>p-value</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td>{v.id.toUpperCase()}</td>
                <td style={{ whiteSpace: "normal", minWidth: 220 }}>{v.headline}</td>
                <td className="num">{v.visitors}</td>
                <td className="num">{v.leads}</td>
                <td className="num">{pct(v.rate)}</td>
                <td className="num">{v.lift === null ? "—" : `${v.lift >= 0 ? "+" : ""}${pct(v.lift)}`}</td>
                <td className="num">
                  {v.pValue === null ? "—" : v.pValue.toFixed(3)}
                  {v.pValue !== null && v.pValue < 0.05 && <span className="pill"> significant</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta" style={{ marginTop: 8, fontSize: "0.85rem" }}>
        Visitors are unique per browser. Wait for at least ~100 leads per variant before calling a winner.
      </p>

      <h2>Leads per day (last 30 days)</h2>
      <div className="table-wrap">
        <div className="bars" role="img" aria-label="Leads per day over the last 30 days">
          {daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.n}`} style={{ height: `${(d.n / max) * 100}%` }} />
          ))}
        </div>
      </div>

      <h2>Recent leads</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Signed up (UTC)</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Variant</th>
              <th>Requests</th>
              <th>Email status</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7}>No leads yet.</td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at}</td>
                <td>{l.name ?? "—"}</td>
                <td>{l.email}</td>
                <td>{l.phone ?? "—"}</td>
                <td>{l.variant?.toUpperCase() ?? "—"}</td>
                <td className="num">{l.request_count}</td>
                <td title={l.email_error ?? undefined}>
                  <span className={l.email_status === "sent" ? "pill" : "pill bad"}>{l.email_status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
