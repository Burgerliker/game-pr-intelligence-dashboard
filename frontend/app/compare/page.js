"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { apiGet, apiPost } from "../../lib/api";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";

const PAGE_SIZE = 40;
const COMPARE_COLLECTION_DISABLED = true;
const SENTIMENTS = ["긍정", "중립", "부정"];

function ratioToWidth(v) {
  const n = Number(v || 0);
  return `${Math.max(0, Math.min(100, n))}%`;
}

export default function ComparePage() {
  const [companies, setCompanies] = useState(["넥슨", "NC소프트", "넷마블", "크래프톤"]);
  const [articleCount, setArticleCount] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterSentiment, setFilterSentiment] = useState("전체");
  const [dataSource, setDataSource] = useState("live");
  const [articleRows, setArticleRows] = useState([]);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const sentinelRef = useRef(null);

  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};
  const insights = data?.insights ?? {};
  const trendRows = data?.trend ?? [];
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const selectedFromData = data?.meta?.selected_companies ?? [];

  const toggleCompany = (name) => {
    setCompanies((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  };

  const loadArticles = async ({ reset = false, companyOverride, sentimentOverride } = {}) => {
    const companyVal = companyOverride ?? filterCompany;
    const sentimentVal = sentimentOverride ?? filterSentiment;
    const nextOffset = reset ? 0 : articleOffset;
    const query = new URLSearchParams({
      company: companyVal,
      sentiment: sentimentVal,
      limit: String(PAGE_SIZE),
      offset: String(nextOffset),
    });

    setArticleLoading(true);
    try {
      const payload = await apiGet(`/api/articles?${query.toString()}`);
      setArticleRows((prev) => (reset ? payload.items : [...prev, ...payload.items]));
      setArticleOffset((reset ? 0 : nextOffset) + payload.items.length);
      setArticleTotal(payload.total || 0);
      setArticleHasMore(Boolean(payload.has_more));
    } catch (e) {
      setError(String(e));
    } finally {
      setArticleLoading(false);
    }
  };

  const runAnalyze = async () => {
    if (COMPARE_COLLECTION_DISABLED) {
      setError("경쟁사 비교 수집 기능은 현재 비활성화되어 있습니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await apiPost("/api/analyze", {
        companies,
        articles_per_company: articleCount,
      });
      setData(payload);
      setDataSource("live");
      setFilterCompany("전체");
      setFilterSentiment("전체");
      await loadArticles({ reset: true, companyOverride: "전체", sentimentOverride: "전체" });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiPost("/api/demo");
      setData(payload);
      setDataSource("demo");
      setArticleRows([]);
      setArticleOffset(0);
      setArticleTotal(0);
      setArticleHasMore(false);
      setFilterCompany("전체");
      setFilterSentiment("전체");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const trendSeries = useMemo(() => {
    if (!trendRows.length || !selectedFromData.length) return [];
    const recent = trendRows.slice(-14);
    return selectedFromData.map((company) => {
      const points = recent.map((row) => ({ date: row.date, value: Number(row[company] || 0) }));
      const max = Math.max(...points.map((p) => p.value), 1);
      return { company, points, max };
    });
  }, [trendRows, selectedFromData]);

  const sentimentByCompany = useMemo(() => {
    const map = {};
    for (const row of sentimentRows) {
      if (!map[row.company]) map[row.company] = { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
      map[row.company][row.sentiment] = Number(row.ratio || 0);
      map[row.company].total += Number(row.count || 0);
    }
    return map;
  }, [sentimentRows]);

  const keywordCards = useMemo(
    () =>
      selectedFromData.map((company) => ({
        company,
        items: (keywordsMap[company] || []).slice(0, 10).map((it) => ({ keyword: it[0], count: it[1] })),
      })),
    [keywordsMap, selectedFromData]
  );

  const filteredDemoArticles = useMemo(() => {
    let rows = (data?.latest_articles || []).slice();
    if (filterCompany !== "전체") rows = rows.filter((r) => r.company === filterCompany);
    if (filterSentiment !== "전체") rows = rows.filter((r) => r.sentiment === filterSentiment);
    return rows.slice(0, 100);
  }, [data, filterCompany, filterSentiment]);

  const displayedArticles = dataSource === "live" ? articleRows : filteredDemoArticles;

  useEffect(() => {
    if (!data || dataSource !== "live") return;
    loadArticles({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCompany, filterSentiment, dataSource]);

  useEffect(() => {
    if (dataSource !== "live") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && articleHasMore && !articleLoading) loadArticles();
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleHasMore, articleLoading, dataSource]);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#eef0f3", py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={{ maxWidth: "1180px !important" }}>
        <Stack spacing={2}>
          <Paper
            sx={{
              borderRadius: 3,
              border: "1px solid #e5e7eb",
              bgcolor: "#f8fafc",
              px: { xs: 2, md: 3 },
              py: 1.2,
              boxShadow: "0 8px 24px rgba(15,23,42,.04)",
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 22, height: 22, borderRadius: 1.2, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>경쟁사 비교 현황판</Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button component={Link} href="/" variant="outlined" size="small">메인</Button>
                <Button component={Link} href="/nexon" variant="outlined" size="small">넥슨 IP 리스크</Button>
              </Stack>
            </Stack>
          </Paper>

          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "rgba(15,23,42,.1)", boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
            <CardContent>
              <Stack spacing={1.5}>
                {COMPARE_COLLECTION_DISABLED ? <Alert severity="info">보호 모드: 수집 버튼은 잠금 상태입니다. 데모 데이터로 화면 확인만 가능합니다.</Alert> : null}
                {error ? <ErrorState title="요청 처리 실패" details={error} /> : null}

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {["넥슨", "NC소프트", "넷마블", "크래프톤"].map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      onClick={() => toggleCompany(name)}
                      color={companies.includes(name) ? "primary" : "default"}
                      variant={companies.includes(name) ? "filled" : "outlined"}
                    />
                  ))}
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                  <Box sx={{ minWidth: 280, maxWidth: 360, width: "100%" }}>
                    <Typography variant="body2" color="text.secondary">회사당 기사 수: {articleCount}</Typography>
                    <Slider
                      min={10}
                      max={100}
                      step={10}
                      value={articleCount}
                      onChange={(_, v) => setArticleCount(Number(v))}
                    />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={runAnalyze} disabled={COMPARE_COLLECTION_DISABLED || loading || companies.length === 0}>
                      {loading ? "처리 중..." : "수집 시작"}
                    </Button>
                    <Button variant="outlined" onClick={loadDemo} disabled={loading}>데모 데이터</Button>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {!data ? (
            <LoadingState title="비교 데이터 대기 중" subtitle="데모 데이터 버튼으로 즉시 화면을 확인할 수 있습니다." />
          ) : (
            <>
              <Grid container spacing={1.4}>
                {Object.entries(companyCounts).map(([name, count]) => (
                  <Grid item xs={6} md={4} key={name}>
                    <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">{name}</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800 }}>{Number(count).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">보도 건수</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                <Grid item xs={6} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">총합</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>{Number(total).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">전체 기사</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={1.4}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)", height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>일별 보도량 추이 (최근 14일)</Typography>
                      <Stack spacing={1.2}>
                        {trendSeries.map((series) => (
                          <Box key={series.company}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{series.company}</Typography>
                            <Stack direction="row" spacing={0.3} sx={{ mt: 0.8, height: 56, alignItems: "end" }}>
                              {series.points.map((p) => (
                                <Box key={`${series.company}-${p.date}`} title={`${p.date}: ${p.value}건`} sx={{ flex: 1 }}>
                                  <Box sx={{ width: "100%", height: `${(p.value / series.max) * 100}%`, minHeight: 2, borderRadius: 0.5, bgcolor: "#2f67d8" }} />
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)", height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>감성 분석</Typography>
                      <Stack spacing={1.4}>
                        {selectedFromData.map((company) => {
                          const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0 };
                          return (
                            <Box key={company}>
                              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>{company}</Typography>
                              {SENTIMENTS.map((s) => (
                                <Stack key={`${company}-${s}`} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ width: 30 }}>{s}</Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.max(0, Math.min(100, Number(row[s] || 0)))}
                                    sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: "#edf2fb" }}
                                  />
                                  <Typography variant="caption" sx={{ width: 48, textAlign: "right" }}>{Number(row[s] || 0).toFixed(1)}%</Typography>
                                </Stack>
                              ))}
                            </Box>
                          );
                        })}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>회사별 키워드</Typography>
                  <Grid container spacing={1.1}>
                    {keywordCards.map((card) => (
                      <Grid item xs={12} md={6} key={card.company}>
                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>{card.company}</Typography>
                          <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                            {card.items.map((it) => (
                              <Chip key={`${card.company}-${it.keyword}`} size="small" variant="outlined" label={`${it.keyword} · ${it.count}`} />
                            ))}
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>핵심 인사이트</Typography>
                  <Grid container spacing={1.1}>
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, height: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>Top 5 이슈</Typography>
                        <Stack spacing={0.8}>
                          {(insights.top_issues || []).map((item, idx) => (
                            <Typography key={`${item.company}-${item.keyword}-${idx}`} variant="caption" color="text.secondary">
                              <b>{item.company}</b> · {item.keyword} ({item.count}건, {item.share_pct}%)
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, height: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>실행 제안</Typography>
                        <Stack spacing={0.8}>
                          {(insights.actions || []).map((item) => (
                            <Typography key={`${item.company}-${item.priority}`} variant="caption" color="text.secondary">
                              <b>{item.company}</b> ({item.priority}) {item.action}
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}>
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>최신 기사 목록</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        label={`회사: ${filterCompany}`}
                        variant="outlined"
                        onClick={() => setFilterCompany(filterCompany === "전체" ? (selectedFromData[0] || "전체") : "전체")}
                      />
                      <Chip
                        size="small"
                        label={`감성: ${filterSentiment}`}
                        variant="outlined"
                        onClick={() => setFilterSentiment(filterSentiment === "전체" ? "부정" : "전체")}
                      />
                      <Chip
                        size="small"
                        label={dataSource === "live" ? `불러온 기사: ${displayedArticles.length} / ${articleTotal}` : `필터 결과: ${displayedArticles.length}`}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>

                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>회사</TableCell>
                          <TableCell>제목</TableCell>
                          <TableCell>감성</TableCell>
                          <TableCell>날짜</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayedArticles.map((a, idx) => (
                          <TableRow key={`${a.url}-${idx}`} hover>
                            <TableCell>{a.company}</TableCell>
                            <TableCell>
                              {a.url ? (
                                <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#0f3b66", textDecoration: "none" }}>
                                  {a.title}
                                </a>
                              ) : (
                                a.title
                              )}
                            </TableCell>
                            <TableCell>{a.sentiment}</TableCell>
                            <TableCell>{a.date}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>

                  <Box ref={sentinelRef} sx={{ mt: 1.2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {dataSource === "live"
                        ? articleLoading
                          ? "기사 불러오는 중..."
                          : articleHasMore
                            ? "아래로 스크롤하면 계속 불러옵니다."
                            : "마지막 기사입니다."
                        : ""}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </>
          )}

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary" align="center">
            포트폴리오 비교 화면 · 데이터 상태에 따라 결과가 달라질 수 있습니다.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
