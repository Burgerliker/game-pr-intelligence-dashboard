export const MOCK_IP_CATALOG = [
  { id: "all", name: "넥슨 (전체보기)" },
  { id: "maplestory", name: "메이플스토리" },
  { id: "dnf", name: "던전앤파이터" },
  { id: "arcraiders", name: "아크레이더스" },
  { id: "fconline", name: "FC온라인" },
  { id: "bluearchive", name: "블루아카이브" },
];

export function createEmptyRisk(targetIp, catalog = MOCK_IP_CATALOG) {
  const ipName = (catalog || MOCK_IP_CATALOG).find((x) => x.id === targetIp)?.name || targetIp;
  return {
    meta: {
      company: "넥슨",
      ip: ipName,
      ip_id: targetIp,
      date_from: "2024-01-01",
      date_to: "2026-12-31",
      total_articles: 0,
    },
    daily: [],
    outlets: [],
    risk_themes: [],
    ip_catalog: catalog || MOCK_IP_CATALOG,
  };
}

export function createEmptyCluster(targetIp) {
  return {
    meta: { cluster_count: 0, total_articles: 0, ip_id: targetIp },
    top_outlets: [],
    keyword_cloud: [],
    clusters: [],
  };
}

export function normalizeNexonDashboard({
  targetIp,
  riskPayload,
  clusterPayload,
  useMockFallback,
  mockRisk,
  mockCluster,
  baseCatalog,
}) {
  const okRisk = Number(riskPayload?.meta?.total_articles || 0) > 0;
  const okCluster = Number(clusterPayload?.meta?.cluster_count || 0) > 0;
  const ipName = (riskPayload?.ip_catalog || MOCK_IP_CATALOG).find((x) => x.id === targetIp)?.name || targetIp;
  const riskData = okRisk
    ? riskPayload
    : useMockFallback
      ? { ...mockRisk, meta: { ...mockRisk.meta, ip_id: targetIp, ip: ipName, total_articles: 0 } }
      : createEmptyRisk(targetIp, riskPayload?.ip_catalog || baseCatalog);
  const clusterData = okCluster
    ? clusterPayload
    : useMockFallback
      ? mockCluster
      : createEmptyCluster(targetIp);

  return {
    riskData,
    clusterData,
    usingMock: !(okRisk && okCluster) && useMockFallback,
    notice:
      !(okRisk && okCluster) && !useMockFallback
        ? "실데이터가 없어 빈 상태로 표시 중입니다. 백엔드 수집/API 상태를 확인해주세요."
        : "",
  };
}
