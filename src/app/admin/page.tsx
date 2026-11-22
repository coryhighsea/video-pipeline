import type { Metadata } from "next";
import { experiment } from "@/config/funnel";
import DeleteLeadButton from "./DeleteLeadButton";
import {
  boxSignupStats,
  dailyLeads,
  experimentStats,
  labelFor,
  overview,
  qualifyBreakdown,
  recentLeads,
  signupFormPath,
  sourceStats,
  type SourceRow,
} from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Funnel dashboard", robots: { index: false } };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function SourceTable({ rows, campaigns }: { rows: SourceRow[]; campaigns?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            {campaigns && <th>Campaign</th>}
            {campaigns && <th>Ad / content</th>}
            <th>Visitors</th>
            <th>Leads</th>
            <th>Conversion</th>
            <th>Subscribed</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={campaigns ? 7 : 5}>
                {campaigns ? "No tagged (utm_campaign) traffic yet." : "No visits yet."}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={`${r.source}|${r.campaign}|${r.content}`}>
              <td>{r.source}</td>
              {campaigns && <td>{r.campaign ?? "—"}</td>}
              {campaigns && <td>{r.content ?? "—"}</td>}
              <td className="num">{r.visitors}</td>
              <td className="num">{r.leads}</td>
              <td className="num">{r.visitors ? pct(r.leads / r.visitors) : "—"}</td>
              <td className="num">{r.subscribers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const o = overview();
  const variants = experimentStats();
  const daily = dailyLeads(30);
  const max = Math.max(1, ...daily.map((d) => d.n));
  const leads = recentLeads(50);
  const breakdown = qualifyBreakdown();
  const sources = sourceStats();
  const campaigns = sourceStats(true);
  const boxSignups = boxSignupStats();

  return (
    <div className="admin">
      <h1>Funnel dashboard</h1>
      <p className="meta">
        Current experiment: <code>{experiment.id}</code> · <a className="btn" href="/admin/newsletter">Newsletter</a> ·{" "}
        <a className="btn" href="/admin/leads.csv">Export all leads (CSV)</a>
      </p>

      <div className="tiles">
        <Tile label="Total leads" value={o.totalLeads} />
        <Tile label="Last 24 hours" value={o.leads24h} />
        <Tile
          label="Answered the questions"
          value={o.qualified}
          sub={o.totalLeads ? pct(o.qualified / o.totalLeads) : undefined}
        />
        <Tile
          label="Newsletter subscribers"
          value={o.subscribers}
          sub={o.totalLeads ? `${pct(o.subscribers / o.totalLeads)} of leads` : undefined}
        />
        <Tile label="From blog & about" value={o.boxSignups} />
        <Tile label="Unsubscribed" value={o.unsubscribed} />
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
        Visitors are counted once per IP + browser (no cookies), so the same person on a new network may count
        twice. Wait for at least ~100 leads per variant before calling a winner.
      </p>

      <h2>Where visitors come from</h2>
      <SourceTable rows={sources} />
      <p className="meta" style={{ marginTop: 8, fontSize: "0.85rem" }}>
        From UTM tags in the link, otherwise the referring site. &ldquo;direct&rdquo; = no referrer (typed URL, or an
        app that hides it). &ldquo;unknown&rdquo; = leads from before source tracking.
      </p>

      <h2>Campaigns and ads</h2>
      <SourceTable rows={campaigns} campaigns />

      <h2>Subscribe-box signups by page</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Signups</th>
              <th>Still subscribed</th>
            </tr>
          </thead>
          <tbody>
            {boxSignups.length === 0 && (
              <tr>
                <td colSpan={3}>No subscribe-box signups yet.</td>
              </tr>
            )}
            {boxSignups.map((b) => (
              <tr key={b.form}>
                <td>
                  <a className="btn" href={b.path}>
                    {b.path}
                  </a>
                </td>
                <td className="num">{b.leads}</td>
                <td className="num">{b.subscribers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta" style={{ marginTop: 8, fontSize: "0.85rem" }}>
        The subscribe boxes at the end of articles and on /about. These signups aren&apos;t part of the A/B test or
        the source tables above, which only cover the checklist page.
      </p>

      <h2>Leads per day (last 30 days)</h2>
      <div className="table-wrap">
        <div className="bars" role="img" aria-label="Leads per day over the last 30 days">
          {daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.n}`} style={{ height: `${(d.n / max) * 100}%` }} />
          ))}
        </div>
      </div>

      <h2>Who&apos;s signing up</h2>
      <div className="breakdowns">
        {breakdown.map((b) => (
          <div className="table-wrap" key={b.question}>
            <table>
              <thead>
                <tr>
                  <th>{b.question}</th>
                  <th>Leads</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="num">{r.n}</td>
                    <td className="num">{b.answered ? pct(r.n / b.answered) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <h2>Recent leads</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Signed up (UTC)</th>
              <th>Name</th>
              <th>Email</th>
              <th>Main job</th>
              <th>Side hustle</th>
              <th>Newsletter</th>
              <th>Variant</th>
              <th>Via</th>
              <th>Source</th>
              <th>Requests</th>
              <th>Email status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={12}>No leads yet.</td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at}</td>
                <td>{l.name ?? "—"}</td>
                <td>{l.email}</td>
                <td>{labelFor("jobStatus", l.job_status)}</td>
                <td>{labelFor("hustleStage", l.hustle_stage)}</td>
                <td>
                  {l.unsubscribed_at ? (
                    <span className="pill bad">unsubscribed</span>
                  ) : l.newsletter === "confirmed" ? (
                    <span className="pill">subscribed</span>
                  ) : (
                    "PDF only"
                  )}
                </td>
                <td>{l.variant?.toUpperCase() ?? "—"}</td>
                <td>{l.signup_form && l.signup_form !== "landing" ? signupFormPath(l.signup_form) : "checklist page"}</td>
                <td>
                  {l.source ?? "—"}
                  {l.campaign && <span className="meta"> / {l.campaign}</span>}
                </td>
                <td className="num">{l.request_count}</td>
                <td style={{ whiteSpace: "normal", minWidth: 120 }}>
                  <span className={l.email_status === "sent" ? "pill" : "pill bad"}>{l.email_status}</span>
                  {l.email_error && <div className="err-detail">{l.email_error}</div>}
                </td>
                <td>
                  <DeleteLeadButton id={l.id} email={l.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {sub && <span className="sub"> {sub}</span>}
      </div>
    </div>
  );
}
