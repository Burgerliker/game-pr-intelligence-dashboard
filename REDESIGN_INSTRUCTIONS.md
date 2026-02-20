# Game PR Intelligence Dashboard — 리디자인 지시문 v3.0

> **방향**: MUI sx 단일화 + 홍보팀 언어로 전면 교체
> **기준**: 홈 페이지(`/app/page.js`) 스타일을 전 페이지의 표준으로 삼는다

---

## 1. 핵심 방향

### 1.1 스타일링 단일화

홈 페이지는 이미 MUI sx + `lib/uiTokens.js` 단일 체계로 깔끔하게 되어 있다.
나머지 페이지들(compare, nexon, backtest, project)이 globals.css 컴포넌트 클래스, Tailwind className, inline style을 뒤섞어서 망가져 있다.

**목표: compare·nexon·backtest·project 페이지를 홈 페이지 방식으로 통일한다.**

### 1.2 허용/금지

| 구분 | 내용 |
|------|------|
| ✅ 허용 | MUI sx prop |
| ✅ 허용 | `lib/uiTokens.js` 토큰 |
| ✅ 허용 | lucide-react 아이콘 |
| ✅ 허용 | `style={{ }}` — 그라디언트, 동적 색상만 |
| ❌ 금지 | `className="..."` (Tailwind) |
| ❌ 금지 | globals.css 컴포넌트 클래스 import |
| ❌ 금지 | `style={{ padding: ..., margin: ... }}` 정적 inline style |

### 1.3 홈 페이지

**건드리지 않는다. 이미 올바른 방식으로 작성되어 있다.**

---

## 2. globals.css 정리

컴포넌트 클래스를 전부 삭제한다. 토큰과 리셋만 남긴다.

### 삭제 대상 (전부 삭제)
```
.card, .chip, .panel, .hero, .topbar, .controls,
.compareHeader, .compareBrand,
.sparkline, .sentRow, .sentTrack, .sentFill,
.nexonKpiGrid, .nexonRiskFill, .nexonStackedBar,
.actionTrack, .riskStickyStage
기타 모든 컴포넌트 셀렉터
```

### 유지 대상
- `@tailwind base/components/utilities` (단, Tailwind preflight는 현재대로 유지)
- `:root` 토큰 블록
- 폰트 import (`@import url(...)`)

---

## 3. 용어 변환표

코드에서 발견된 개발 언어를 홍보팀 실무 언어로 전부 교체한다.
**텍스트 교체만 한다. 변수명·함수명은 건드리지 않는다.**

### 3.1 전체 공통

| AS-IS (화면 표시) | TO-BE (화면 표시) |
|-------------------|-------------------|
| Risk / risk | 위기 지수 |
| Heat / heat | 이슈량 |
| Backtest | 과거 분석 |
| 샘플 데이터 | 예시 데이터 |
| 표본 | 기사 수 |
| 노출량 | 보도량 |
| 수집 | 모니터링 |
| 버스트 / burst | 급등 |
| 이슈 묶음 | 이슈 분류 |
| 클러스터 / cluster | 이슈 그룹 |
| 감성 | 여론 |
| IP | 게임 (문맥에 따라) |
| 백엔드 | 시스템 |
| API | 데이터 연동 |
| 동기화 | 업데이트 |
| 조회 | 확인 / 분석 |

### 3.2 compare 페이지 — 구체적 변환

| 위치 | AS-IS | TO-BE |
|------|-------|-------|
| 섹션 카드 타이틀 | 조회 대상 회사 | 비교할 게임사 |
| info 문구 | 최근 {n}시간 수집 기준입니다. | 최근 {n}시간 기사 기준입니다. |
| 상태칩 | 조회 전용 | (삭제) |
| 상태칩 | 자동 갱신: {n}초 | {n}초마다 자동 업데이트 |
| 추이 옵션칩 | 기사수 | 보도 건수 |
| 추이 옵션칩 | Risk(위험도) | 위기 지수 |
| 추이 옵션칩 | Heat(이슈량) | 이슈량 |
| 범례칩 | 0건: 수집 없음 | 0건: 기사 없음 |
| 범례칩 | 저건수: {n}건 미만 | 소량: {n}건 미만 |
| 범례칩 | 정상: 표본 안정 구간 | 충분: 분석 가능 |
| 섹션 타이틀 | 일별 보도량 추이 (최근 14일) | 보도 추이 (최근 14일) |
| 안내 문구 | 기사수/위험도/이슈량은 백엔드 산출값만 사용합니다. | 지표는 시스템 산출값입니다. |
| Alert | 현재 서버 응답에 Risk/Heat 일자별 지표가 없어 기사수 추이로 대체 표시 중입니다. | 위기 지수 추이 데이터가 없어 보도량 추이로 표시합니다. |
| Alert | 표본 부족 구간이 포함되어 Risk/Heat 해석 신뢰도가 낮습니다. | 기사 수가 적은 구간이 포함되어 있어 정확도가 낮을 수 있습니다. |
| 칩 라벨 | `Risk 최대 {n}` | `위기 지수 최대 {n}` |
| 칩 라벨 | `Heat 최대 {n}` | `이슈량 최대 {n}` |
| 섹션 타이틀 | 감성 분석 | 여론 분포 |
| 설명 문구 | 표본 0건은 비율 대신 상태 안내만 표시됩니다. | 기사가 없으면 여론 비율을 계산할 수 없습니다. |
| 빈 상태 | 표본 없음 | 기사 없음 |
| 빈 상태 | 감성 비율을 계산할 수 없습니다. | 여론 비율을 계산할 수 없습니다. |
| 섹션 타이틀 | 회사별 키워드 | 게임사별 주요 키워드 |
| 섹션 타이틀 | 핵심 인사이트 | 대응 인사이트 |
| 서브섹션 | Top 5 이슈 | 주목 이슈 TOP 5 |
| 필터칩 | 회사: {n} | 게임사: {n} |
| 필터칩 | 감성: {n} | 여론: {n} |
| 필터칩 | 필터 결과: {n} | 표시 중: {n}건 |
| 섹션 타이틀 | 최신 기사 목록 | 최신 기사 |
| 하단 안내 | 포트폴리오 비교 화면 · compare는 조회 전용이며 자동 갱신으로 최신 상태를 유지합니다. | 실시간으로 자동 업데이트됩니다. |

### 3.3 nexon 페이지 — 구체적 변환

| 위치 | AS-IS | TO-BE |
|------|-------|-------|
| 네비 버튼 | Backtest 보기 | 과거 분석 |
| 섹션 라벨 | 모니터링 IP | 분석 중인 게임 |
| 배너 서브텍스트 | 해당 IP 리스크 흐름 · 이슈 묶음 · 집중 수집 모니터 | 위기 흐름 · 이슈 분류 · 집중 모니터링 |
| 배너 칩 | 위험도 {n} | 위기 지수 {n} |
| 배너 칩 | 24h 노출량 {n}건 | 오늘 보도량 {n}건 |
| 배너 칩 | 이슈 묶음 {n} | 이슈 분류 {n} |
| KPI 라벨 | 총 노출량(재배포 포함) | 총 보도량 |
| KPI 라벨 | 최고 위험 테마 | 핵심 위험 이슈 |
| KPI 라벨 | 이슈 묶음 수 | 이슈 분류 수 |
| KPI 서브 | 유사 기사 주제 묶음 | 유사 기사 그룹 |
| KPI 서브 | `Risk {n}` | `위기 지수 {n}` |
| 기준 안내 문구 | 기준 안내: 노출량은 재배포 포함 지표입니다. 이슈 묶음 수는 유사 주제 묶음 규모로, 노출량 지표와 의미가 다릅니다. | 보도량은 재배포 포함 수치입니다. 이슈 분류는 유사 기사 그룹 수입니다. |
| 섹션 타이틀 | 실시간 위험도 모니터 | 현재 위기 상태 |
| 서브 타이틀 | 현재 위험 상태 | 위기 지수 |
| 칩 | 판정 기준: 최신 모델 | 최신 분석 기준 적용 중 |
| 칩 | 판정 기준: 기본 모델 | 기본 분석 기준 적용 중 |
| Alert | 표본이 부족해 현재 위험도 신뢰도가 낮습니다. 수치 해석보다 추세 확인을 우선하세요. | 기사 수가 적어 위기 지수의 정확도가 낮을 수 있습니다. 추세 변화를 우선 확인하세요. |
| 안내 문구 | 최근 {n}시간 노출량 기준 · 이슈 관심도 {n} | 최근 {n}시간 보도량 기준 · 이슈량 {n} |
| 서브섹션 | 최근 24시간 노출량: {n} | 오늘 보도량: {n} |
| 서브섹션 | 최근 7일 기준선: {min}–{max}건 | 지난 7일 평균: {min}–{max}건 |
| 서브텍스트 | 기준선 대비 {n}배 | 평균 대비 {n}배 |
| 서브 타이틀 | 왜 이렇게 나왔나요? | 위기 지수 해석 |
| 본문 | 노출량: {n}건 ({volumeHint}) · 확산: {n} · 분류애매: {n}% | 보도량: {n}건 ({volumeHint}) · 확산도: {n} · 여론 불명확: {n}% |
| 상세설명 | 노출량은 최근 24시간 기준 총 노출(재배포 포함) 수치입니다. | 보도량은 최근 24시간 기준 총 기사 수(재배포 포함)입니다. |
| 상세설명 | 분류애매는 감성 판단이 어려운 기사 비율입니다. | 여론 불명확은 긍/부정 판단이 어려운 기사 비율입니다. |
| LabelWithTip | 경보 등급 (tipMap.alert) | 대응 우선순위 |
| tip 내용 | 위험도 구간별 대응 우선순위 등급입니다. | 위기 지수 수준에 따른 대응 우선순위입니다. |
| 서브 타이틀 | 수집 상태 | 모니터링 현황 |
| 본문 | BURST 수집 | 집중 모니터링 중 |
| 본문 | 정상 수집 | 정상 모니터링 |
| 본문 | 주기 {n}s | 갱신 주기 {n}초 |
| 본문 | 남은 {n}s | 남은 시간 {n}초 |
| 본문 | 최근 30분 이벤트 {n}건 | 최근 30분 급등 {n}건 |
| 서브 타이틀 | Risk vs Heat | 위기 지수 vs 이슈량 |
| 본문 | Risk는 "부정 신호 강도", Heat는 "언급량/관심도"입니다. | 위기 지수(Risk)는 부정 여론 강도, 이슈량(Heat)은 언급 빈도입니다. |
| 확장 버튼 | 상세 구성요소(S/V/T/M) | 위기 지수 구성 요소 |
| 신호 라벨 | 볼륨 신호 | 보도량 신호 |
| LabelWithTip | 버스트 이벤트 (tipMap.burst) | 급등 이벤트 |
| tip 내용 | 최근 임계치 이벤트 발생 로그입니다. | 단기간에 기사가 급증한 이벤트 기록입니다. |
| 칩 | 최근 {n} 이벤트 {m}건 | 최근 {n} 급등 {m}건 |
| 칩 | 최근 발생 {시각} | 마지막 급등 {시각} |
| 칩 | 있음 / 없음 | 감지됨 / 없음 |
| 버튼 | 24h | 24시간 |
| 버튼 | 7d | 7일 |
| 버튼 | 이벤트 보기 / 이벤트 닫기 | 목록 보기 / 접기 |
| 빈 상태 | 버스트 이벤트 없음 | 급등 이벤트 없음 |
| 빈 상태 서브 | 선택한 기간({n})에는 집중 수집 전환 기록이 없습니다. | 선택 기간에 기사 급증 이벤트가 없습니다. |
| LabelWithTip | (이슈 묶음 수) tipMap.cluster | — |
| tip 내용 | 유사 기사 키워드로 묶은 이슈 그룹 수입니다. | 비슷한 키워드의 기사를 묶은 이슈 분류 수입니다. |
| 섹션 타이틀 | 일자별 노출량/부정 추이 | 일별 보도량 및 부정 비율 추이 |
| ECharts 레전드 | 노출량 | 보도량 |
| ECharts 레전드 | 부정 비율 | 부정 여론 비율 |
| ECharts y축 | 노출량(건) | 보도량(건) |
| ECharts y축 | 부정비율(%) | 부정 비율(%) |
| ECharts tooltip | `노출량: {n}건` | `보도량: {n}건` |
| 섹션 타이틀 | 언론사별 감성 분포 | 언론사별 여론 분포 |
| 섹션 타이틀 | 위험 테마 점수 | 위험 이슈 점수 |
| ECharts legend | 위험 점수(%) | 위험도(%) |
| 섹션 타이틀 | 키워드 중요도 맵 | 주요 키워드 |
| 섹션 타이틀 | 실행 인사이트 | 대응 인사이트 |
| 서브 타이틀 | 최우선 위험 테마 | 핵심 위험 이슈 |
| 서브 타이틀 | 고위험 노출 매체 | 주목할 언론사 |
| 캡션 | 위험점수 {n} · 부정 {n}% | 위험도 {n} · 부정 {n}% |
| 캡션 | 노출점수 {n} | 위험 점수 {n} |
| 섹션 타이틀 | 이슈 묶음 분석 | 이슈 유형 분석 |
| 캡션 | 기사 {n}건 · 부정 {n}% | {n}건 · 부정 {n}% |
| 캡션 | 키워드: ... | 관련 키워드: ... |
| 캡션 | 대표 기사: ... | 주요 기사: ... |
| 섹션 타이틀 | 수집 기사 목록 | 최신 기사 |
| 로딩 텍스트 | 기사 목록을 불러오는 중… | 기사를 불러오는 중… |
| 완료 텍스트 | 마지막 기사까지 모두 불러왔습니다. | 전체 기사를 불러왔습니다. |
| 빈 상태 | 수집 기사 없음 | 기사 없음 |
| 빈 상태 서브 | 현재 조건에서 표시할 기사가 없습니다. | 해당 조건의 기사가 없습니다. |
| 빈 상태 | 위험도 데이터가 아직 없습니다. | 위기 지수 데이터를 불러오는 중입니다. |
| 빈 상태 서브 | 아직 집중 수집 전환 기록이 없습니다. (실시간 신호 대기 중) | 급등 이벤트 기록이 없습니다. |
| PageStatusView 로딩 | IP 데이터를 동기화하는 중 | 데이터를 불러오는 중 |
| PageStatusView 로딩 서브 | 리스크/이슈 묶음/집중 수집 상태를 갱신하고 있습니다. | 위기 지수와 이슈 분류를 업데이트하고 있습니다. |
| PageStatusView 에러 | 대시보드 데이터를 불러오지 못했습니다. | 데이터를 불러오지 못했습니다. |
| PageStatusView 에러 액션 | 재시도 | 다시 시도 |
| 모드 불일치 경고 | 현재 운영 페이지가 백테스트 DB를 참조 중입니다. | 현재 과거 분석 데이터를 참조 중입니다. |

### 3.4 backtest 페이지 — 확인 후 동일 기준 적용

backtest 페이지도 읽은 후 3.3과 동일한 기준으로 용어 교체한다.

### 3.5 project 페이지

현재 inline style 객체로 작성되어 있다. MUI sx로 전환한다.
텍스트 내용은 변경하지 않는다 (이미 실무 언어로 작성되어 있음).

---

## 4. 절대 수정 금지 항목

### 4.1 로직/데이터 레이어

- 모든 `useEffect`, `useState`, `useCallback`, `useMemo`, `useRef`
- `lib/api.js`, `lib/pageStatus.js`, `lib/normalizeNexon.js`, `lib/normalizeBacktest.js`
- `lib/uiTokens.js` (확장은 가능, 삭제 금지)
- `react-window` List 컴포넌트 로직
- ECharts `setOption` 내용 (단, 레전드/축 라벨 텍스트 교체는 허용 — 위 용어 변환표 참조)
- API 엔드포인트 URL, 쿼리 파라미터
- 변수명, 함수명, state명, 상수명

### 4.2 유지할 UI 요소

- `IP_BANNER_STYLE` 색상/그라디언트 (다크 배너 디자인 유지)
- `bannerPagerBtnSx` (페이저 버튼 스타일)
- 기사 링크(`a` 태그) 동작
- react-window 가상 스크롤 동작
- 스와이프 핸들러 (`handleBannerTouchStart`, `handleBannerTouchEnd`)

---

## 5. MUI 스타일 통일 지침

홈 페이지의 패턴을 그대로 따른다.

### 5.1 페이지 쉘

```jsx
// 홈 페이지와 동일하게
<Box sx={{ ...pageShellSx, py: { xs: 2, md: 5 } }}>
  <Container maxWidth="xl" sx={pageContainerSx}>
    <Stack spacing={2.3}>
      {/* content */}
    </Stack>
  </Container>
</Box>
```

### 5.2 상단 네비바

```jsx
// 홈 페이지와 동일한 panelPaperSx 사용
<Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc", px: { xs: 2, md: 3 }, py: 1.2, boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={1.2}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: 22, height: 22, borderRadius: 1.2, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em" }}>
        {페이지 타이틀}
      </Typography>
    </Stack>
    <Stack direction="row" spacing={1}>
      <Button component={Link} href="/" variant="outlined" size="small" sx={navButtonSx}>메인</Button>
      {/* 페이지별 추가 버튼 */}
    </Stack>
  </Stack>
</Paper>
```

### 5.3 섹션 카드

```jsx
// uiTokens.js의 sectionCardSx 사용
<Card variant="outlined" sx={sectionCardSx}>
  <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>섹션 타이틀</Typography>
    {/* content */}
  </CardContent>
</Card>
```

### 5.4 내부 패널 (카드 안의 카드)

```jsx
// uiTokens.js의 panelPaperSx 사용
<Paper variant="outlined" sx={{ ...panelPaperSx, p: 1.5 }}>
  {/* content */}
</Paper>
```

### 5.5 필터 칩

```jsx
// uiTokens.js의 filterChipSx 사용
<Chip
  label="하루"
  onClick={() => setWindowHours(24)}
  color={windowHours === 24 ? "primary" : "default"}
  variant={windowHours === 24 ? "filled" : "outlined"}
  sx={filterChipSx}
/>
```

### 5.6 상태 칩

```jsx
// uiTokens.js의 statusChipSx 사용
<Chip size="small" variant="outlined" label="텍스트" sx={statusChipSx} />
```

---

## 6. 페이지별 추가 지시

### 6.1 compare 페이지

- 섹션 구조 자체는 유지한다. 레이아웃 변경 없음
- 용어 변환표(3.2) 적용
- globals.css 클래스 제거 후 sx로 대체
- `INTERACTIVE_CHIP_SX`는 이미 `filterChipSx`를 참조하므로 그대로 유지

### 6.2 nexon 페이지

- 섹션 구조 유지. 레이아웃 변경 없음
- 용어 변환표(3.3) 전면 적용
- globals.css 클래스 제거 후 sx로 대체
- "버스트 이벤트" 섹션의 버튼 텍스트만 교체 (`24h` → `24시간`, `7d` → `7일`)
- ECharts 내부 텍스트 (formatter, name, 축 레이블) 용어 교체 포함

### 6.3 backtest 페이지

코드를 읽은 후 nexon과 동일한 기준 적용.

### 6.4 project 페이지

- 전체 inline `style={{ }}` 객체를 MUI sx로 전환
- 텍스트 내용 변경 없음
- 구조 변경 없음

---

## 7. 완료 기준

- [ ] globals.css 컴포넌트 클래스 전부 제거
- [ ] 모든 페이지에서 `className=` (Tailwind) 0개
- [ ] 정적 `style={{ }}` 0개 (동적 색상/그라디언트 제외)
- [ ] 용어 변환표 3.2, 3.3 전면 적용
- [ ] ECharts 내부 텍스트 용어 교체 완료
- [ ] 홈 페이지 변경 없음
- [ ] 모든 데이터 로직 동일하게 동작
- [ ] ECharts 차트 정상 렌더링
- [ ] react-window 가상 스크롤 정상 동작
