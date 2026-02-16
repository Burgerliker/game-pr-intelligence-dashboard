export const BACKTEST_P1 = 70;
export const BACKTEST_P2 = 45;

export function normalizeBacktestPayload(payload) {
  const series = payload?.timeseries || [];
  const events = payload?.events || [];

  const timestamps = series.map((r) => String(r.timestamp || ""));
  const risk = series.map((r) => Number(r.risk_score || 0));
  const volume = series.map((r) => Number(r.article_count || 0));
  const s = series.map((r) => Number(r.components?.S || 0));
  const v = series.map((r) => Number(r.components?.V || 0));
  const t = series.map((r) => Number(r.components?.T || 0));
  const m = series.map((r) => Number(r.components?.M || 0));

  const eventRows = events.map((e) => {
    const ts = String(e.timestamp || "");
    const riskAt = Number(e.risk_score || 0);
    const type = String(e.event || "event");
    const label = type.replace("_", " ").toUpperCase();
    return { ts, type, label, risk_at_ts: riskAt };
  });

  return {
    timestamps,
    risk,
    volume,
    svtm: { S: s, V: v, T: t, M: m },
    thresholds: { p1: BACKTEST_P1, p2: BACKTEST_P2 },
    events: eventRows,
  };
}
