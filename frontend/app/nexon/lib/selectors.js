export function calcArticleListHeight(count, rowHeight, minHeight, maxHeight) {
  const estimated = Number(count || 0) * Number(rowHeight || 0);
  if (!estimated) return minHeight;
  return Math.max(minHeight, Math.min(maxHeight, estimated));
}

export function calcCrisisChange(riskTimeseries) {
  if (!Array.isArray(riskTimeseries) || riskTimeseries.length < 2) return 0;
  const rows = riskTimeseries.slice(-2);
  return Number(rows[1]?.risk_score || 0) - Number(rows[0]?.risk_score || 0);
}

export function resolveTopRisk(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return null;
  const prioritized = themes
    .filter((row) => String(row?.theme || "") !== "신작/성과")
    .filter((row) => Number(row?.negative_ratio || 0) >= 5);
  const source = prioritized.length ? prioritized : themes;
  return [...source].sort((a, b) => {
    const diffNeg = Number(b?.negative_ratio || 0) - Number(a?.negative_ratio || 0);
    if (diffNeg !== 0) return diffNeg;
    const diffCount = Number(b?.article_count || 0) - Number(a?.article_count || 0);
    if (diffCount !== 0) return diffCount;
    return Number(b?.risk_score || 0) - Number(a?.risk_score || 0);
  })[0] || null;
}

export function resolveTopIssues(themes) {
  return [...(themes || [])]
    .sort((a, b) => Number(b?.article_count || 0) - Number(a?.article_count || 0))
    .slice(0, 3)
    .map((x) => ({
      name: x?.theme || "-",
      count: Number(x?.article_count || 0),
      severity: Number(x?.negative_ratio || 0) >= 40 ? "high" : "low",
    }));
}

export function resolveOutletRisk(outletRows) {
  if (!Array.isArray(outletRows) || !outletRows.length) return null;
  return [...outletRows]
    .map((x) => ({ ...x, score: Math.round((Number(x.article_count || 0) * Number(x.negative_ratio || 0)) / 100) }))
    .sort((a, b) => b.score - a.score)[0];
}

export function buildStatCards({
  recent24hArticles,
  dailyExposureDelta,
  clusterCount,
  clusterDelta,
  totalArticleSum30d,
  monthlyArticleDelta,
}) {
  return [
    {
      key: "volume",
      label: "24h 보도량",
      value: Number(recent24hArticles || 0).toLocaleString(),
      unit: "건",
      delta: Number(dailyExposureDelta || 0),
      deltaMode: "neutral",
      deltaDigits: 0,
      iconKey: "newspaper",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
    },
    {
      key: "cluster",
      label: "이슈 분류",
      value: Number(clusterCount || 0).toLocaleString(),
      unit: "개",
      delta: Number(clusterDelta || 0),
      deltaMode: "neutral",
      deltaDigits: 0,
      iconKey: "tag",
      color: "#8B5CF6",
      bgColor: "#F5F3FF",
    },
    {
      key: "monthly",
      label: "월간 기사",
      value: Number(totalArticleSum30d || 0).toLocaleString(),
      unit: "건",
      delta: Number(monthlyArticleDelta || 0),
      deltaMode: "neutral",
      deltaDigits: 0,
      iconKey: "fileText",
      color: "#06B6D4",
      bgColor: "#ECFEFF",
    },
  ];
}
