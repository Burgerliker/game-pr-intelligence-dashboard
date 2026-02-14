"""넥슨 PR 인텔리전스 대시보드"""

from datetime import datetime, timedelta

import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from wordcloud import WordCloud

from services.naver_api import COMPANIES, fetch_company_news, get_daily_counts, get_last_api_error
from utils.keywords import get_keyword_data
from utils.sentiment import add_sentiment_column, get_model_id, get_sentiment_summary

COMPANY_LOGOS = {
    "넥슨": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/NEXON_Logo.svg/200px-NEXON_Logo.svg.png",
    "NC소프트": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/NCsoft_logo.svg/200px-NCsoft_logo.svg.png",
    "넷마블": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Netmarble_Logo.svg/200px-Netmarble_Logo.svg.png",
    "크래프톤": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/KRAFTON_logo.svg/200px-KRAFTON_logo.svg.png",
}

SENTIMENT_COLORS = {"긍정": "#00A76F", "중립": "#FFB020", "부정": "#E53935"}


st.set_page_config(
    page_title="NEXON PR 인사이트 센터 | 넥슨 PR 대시보드",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=SUIT:wght@400;500;600;700;800&display=swap');

:root {
    --bg: #e8edf4;
    --card: #ffffff;
    --line: #d6dce6;
    --text: #0e1626;
    --muted: #5b667a;
    --blue: #0d6bff;
    --blue-2: #0048c8;
    --dark: #08152b;
}

.stApp {
    background:
        radial-gradient(1100px 420px at 78% -2%, rgba(39, 115, 255, 0.10), transparent 58%),
        linear-gradient(180deg, #eff3f9 0%, var(--bg) 48%, #e8edf4 100%);
    color: var(--text);
    font-family: 'SUIT', sans-serif;
}

header[data-testid="stHeader"],
[data-testid="stToolbar"],
section[data-testid="stSidebar"] {
    display: none !important;
}

.block-container {
    max-width: 1320px !important;
    padding-top: 0.7rem !important;
    padding-bottom: 2rem !important;
}

.topbar {
    height: 52px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 14px;
}
.topbar .left, .topbar .right {
    color: #4d5a70;
    font-size: 12px;
    font-weight: 700;
}
.topbar .right { text-align: right; }
.topbar .brand {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 38px;
    letter-spacing: 0.09em;
    color: #111827;
    font-weight: 700;
}

.hero {
    margin-top: 10px;
    border-radius: 12px;
    border: 1px solid #162843;
    padding: 24px 24px 22px;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 16px;
    background:
        linear-gradient(120deg, rgba(36,114,255,0.26) 0%, transparent 42%),
        radial-gradient(640px 280px at 78% 38%, rgba(58,130,255,0.34), transparent 58%),
        linear-gradient(108deg, #040a17 0%, #08152f 44%, #0d2a58 100%);
}
.hero .badge {
    display: inline-flex;
    align-items: center;
    border-left: 3px solid #2b8fff;
    padding-left: 9px;
    color: #8ac9ff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
}
.hero .title {
    margin-top: 8px;
    font-family: 'SUIT', sans-serif;
    font-size: clamp(44px, 6vw, 68px);
    line-height: 1.0;
    letter-spacing: -0.04em;
    color: #eef4ff;
    font-weight: 800;
}
.hero .desc {
    margin-top: 10px;
    color: #d0dcf0;
    font-size: 19px;
    max-width: 700px;
}
.hero .meta-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    align-content: center;
}
.meta-card {
    border: 1px solid rgba(161,189,240,0.32);
    background: rgba(13,26,52,0.62);
    border-radius: 10px;
    padding: 11px 12px;
}
.meta-card .k {
    color: #9fb7df;
    font-size: 11px;
    font-weight: 700;
}
.meta-card .v {
    color: #f0f5ff;
    font-size: 14px;
    font-weight: 700;
    margin-top: 2px;
}

.company-track {
    margin-top: 8px;
    padding: 8px 9px;
    border-radius: 10px;
    border: 1px solid #2d3d57;
    background: linear-gradient(90deg, #132036, #1a2a44, #132036);
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
}
.company-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #e9effb;
    font-size: 12px;
    font-weight: 800;
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 999px;
    padding: 5px 11px;
    background: rgba(255,255,255,0.07);
}
.company-chip .dot { width: 7px; height: 7px; border-radius: 999px; }

.control-shell {
    margin-top: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.84));
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px 12px;
    box-shadow: 0 10px 24px rgba(21, 38, 67, 0.08);
}
.control-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
}
.control-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f1a2d;
}
.meta {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
}

.section-title {
    margin: 18px 0 8px;
    font-size: 22px;
    font-weight: 800;
    color: #121d31;
}

.stat-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 6px 18px rgba(14, 29, 53, 0.08);
}
.stat-card .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
}
.stat-card img {
    height: 20px;
    width: auto;
    object-fit: contain;
    display: block;
}
.stat-card .fallback {
    font-size: 13px;
    font-weight: 800;
    color: #1f2937;
}
.stat-card .value {
    margin-top: 8px;
    font-size: 42px;
    line-height: 1;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
}
.stat-card .sub { color: var(--muted); font-size: 12px; font-weight: 700; }

.empty-box {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 72px 24px;
    text-align: center;
}
.empty-box .emoji { font-size: 40px; }
.empty-box .title { margin-top: 8px; font-size: 26px; font-weight: 800; color: #12203a; }
.empty-box .desc { margin-top: 8px; color: #51617b; font-size: 15px; }

.stButton > button[kind="primary"] {
    min-height: 46px !important;
    background: linear-gradient(180deg, var(--blue) 0%, var(--blue-2) 100%) !important;
    border: 1px solid #0044bc !important;
    border-radius: 11px !important;
    font-weight: 800 !important;
    font-size: 15px !important;
    letter-spacing: 0.01em;
    box-shadow: 0 10px 20px rgba(7, 64, 182, 0.25);
}

/* Streamlit default accent override */
:root {
    --primary-color: #0d6bff;
}

[data-baseweb="tag"] {
    background: #ecf3ff !important;
    border: 1px solid #c8dbff !important;
    color: #0b4fb3 !important;
}
[data-baseweb="tag"] span {
    color: #0b4fb3 !important;
}
[data-baseweb="slider"] [role="slider"] {
    border-color: #0d6bff !important;
}
[data-baseweb="slider"] > div > div > div {
    background: #0d6bff !important;
}

div[data-testid="stMetric"], .stDataFrame {
    border-radius: 12px !important;
    border: 1px solid var(--line) !important;
}

.footer {
    margin-top: 24px;
    border-top: 1px solid var(--line);
    padding: 16px 2px;
    color: #59657b;
    font-size: 12px;
}

@media (max-width: 900px) {
    .topbar .brand { font-size: 26px; }
    .hero { grid-template-columns: 1fr; }
    .hero .title { font-size: 52px; }
    .hero .desc { font-size: 15px; }
}
</style>
""",
    unsafe_allow_html=True,
)

st.markdown(
    """
<div class="topbar">
  <div class="left">메뉴</div>
  <div class="brand">NEXON</div>
  <div class="right">회원가입 / 로그인</div>
</div>

<div class="hero">
  <div>
    <div class="badge">NEXON GAME PR INTELLIGENCE</div>
    <div class="title">PR 인사이트 센터</div>
    <div class="desc">여론 흐름, 감성 온도, 이슈 키워드를 한 화면에서 분석해 PR 전략과 리스크 대응 우선순위를 빠르게 결정합니다.</div>
  </div>
  <div class="meta-grid">
    <div class="meta-card">
      <div class="k">분석 엔진</div>
      <div class="v">Hugging Face Sentiment</div>
    </div>
    <div class="meta-card">
      <div class="k">데이터 소스</div>
      <div class="v">네이버 뉴스 검색 API</div>
    </div>
    <div class="meta-card">
      <div class="k">리포트 기준 시각</div>
      <div class="v">실시간 렌더링</div>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)

chip_html = "".join(
    [
        f"<span class='company-chip'><span class='dot' style='background:{meta['color']}'></span>{company}</span>"
        for company, meta in COMPANIES.items()
    ]
)
st.markdown(f"<div class='company-track'>{chip_html}</div>", unsafe_allow_html=True)
st.markdown(
    """
<div class="control-shell">
  <div class="control-head">
    <div class="control-title">컨트롤 콘솔</div>
    <div class="meta">수집 범위와 회사를 먼저 설정한 뒤 실행하세요.</div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)
ctrl1, ctrl2, ctrl3, ctrl4 = st.columns([3.3, 2.0, 1.8, 1.6])

with ctrl1:
    selected_companies = st.multiselect(
        "비교 회사 선택",
        options=list(COMPANIES.keys()),
        default=list(COMPANIES.keys()),
    )

with ctrl2:
    articles_per_company = st.slider(
        "회사당 수집 기사 수",
        min_value=10,
        max_value=100,
        value=60,
        step=10,
        help="네이버 뉴스 검색 API는 호출당 최대 100건을 반환합니다.",
    )

with ctrl3:
    st.markdown(f"<div class='meta'>AI 감성 모델: {get_model_id()}</div>", unsafe_allow_html=True)
    st.markdown(
        f"<div class='meta'>마지막 렌더: {datetime.now().strftime('%Y-%m-%d %H:%M')}</div>",
        unsafe_allow_html=True,
    )

with ctrl4:
    fetch_clicked = st.button("데이터 수집 시작", type="primary", use_container_width=True)

with st.expander("사용 안내", expanded=False):
    st.markdown(
        "1. `.env`에 네이버 API 키를 설정합니다.\n"
        "2. 비교 회사를 선택하고 기사 수를 조정합니다.\n"
        "3. `데이터 수집` 버튼으로 분석을 시작합니다."
    )

if "news_df" not in st.session_state:
    st.session_state.news_df = pd.DataFrame()


# API가 없어도 포트폴리오 데모 확인 가능
if st.button("데모 데이터 불러오기", use_container_width=True):
    import random

    rows = []
    now = datetime.now()
    samples = {
        "넥슨": ["넥슨 신작 글로벌 흥행", "넥슨 업데이트 호평", "넥슨 운영 논란 재점화"],
        "NC소프트": ["NC소프트 신작 기대감", "엔씨소프트 실적 개선", "NC소프트 비용 구조조정"],
        "넷마블": ["넷마블 신작 매출 상승", "넷마블 해외 성과 확대", "넷마블 투자 전략 발표"],
        "크래프톤": ["크래프톤 배그 이용자 증가", "크래프톤 신작 공개", "크래프톤 실적 변동성"],
    }
    for company in COMPANIES:
        for _ in range(36):
            d = now - timedelta(days=random.randint(0, 29))
            title = random.choice(samples[company])
            rows.append(
                {
                    "title_clean": title,
                    "description_clean": f"{title} 관련 상세 기사입니다.",
                    "originallink": "https://news.example.com",
                    "link": "https://news.example.com",
                    "pubDate_parsed": d,
                    "date": d.strftime("%Y-%m-%d"),
                    "company": company,
                }
            )

    demo_df = pd.DataFrame(rows)
    st.session_state.news_df = add_sentiment_column(demo_df)
    st.rerun()

if fetch_clicked:
    if not selected_companies:
        st.warning("비교 회사를 최소 1개 이상 선택해 주세요.")
    else:
        with st.spinner("뉴스를 수집하고 감성 분석을 수행하고 있습니다..."):
            frames = []
            progress_bar = st.progress(0)
            for i, company in enumerate(selected_companies):
                part = fetch_company_news(company, total=articles_per_company)
                if not part.empty:
                    frames.append(part)
                progress_bar.progress((i + 1) / len(selected_companies))

            if frames:
                merged = pd.concat(frames, ignore_index=True)
                merged = merged.drop_duplicates(
                    subset=["company", "originallink", "title_clean"], keep="first"
                ).reset_index(drop=True)
                try:
                    merged = add_sentiment_column(merged)
                except Exception as exc:
                    st.error(f"AI 감성 분석 실행에 실패했습니다: {exc}")
                    st.info("`pip install -r requirements.txt` 실행 후 다시 시도해 주세요.")
                    progress_bar.empty()
                    st.stop()

                st.session_state.news_df = merged
                st.success(f"총 {len(merged)}건의 기사를 수집했습니다.")
            else:
                st.error(get_last_api_error() or "뉴스를 가져오지 못했습니다. API 설정을 확인해 주세요.")
            progress_bar.empty()

df = st.session_state.news_df

if df.empty:
    st.markdown(
        """
<div class="empty-box">
  <div class="emoji">🛰️</div>
  <div class="title">아직 수집된 데이터가 없습니다</div>
  <div class="desc">상단에서 조건을 선택한 뒤 <b>데이터 수집</b>을 눌러 분석을 시작하세요.</div>
</div>
""",
        unsafe_allow_html=True,
    )
    st.stop()

if not selected_companies:
    selected_companies = sorted(df["company"].dropna().unique().tolist())

company_counts = df.groupby("company").size()
total_articles = len(df)

st.markdown(f"<div class='section-title'>핵심 지표 · 총 {total_articles}건</div>", unsafe_allow_html=True)
metric_cols = st.columns(len(selected_companies))
for idx, company in enumerate(selected_companies):
    count = int(company_counts.get(company, 0))
    ratio = (count / total_articles * 100) if total_articles else 0
    color = COMPANIES[company]["color"]
    logo = COMPANY_LOGOS.get(company, "")
    with metric_cols[idx]:
        st.markdown(
            f"""
<div class="stat-card" style="border-top:3px solid {color}">
  <div class="brand">
    <img src="{logo}" alt="{company}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"/>
    <span class="fallback" style="display:none;">{company}</span>
  </div>
  <div class="value">{count}</div>
  <div class="sub">보도 건수 · 점유율 {ratio:.1f}%</div>
</div>
""",
            unsafe_allow_html=True,
        )

st.markdown("<div class='section-title'>일별 보도량 추이</div>", unsafe_allow_html=True)
trend_counts = get_daily_counts(df)
if not trend_counts.empty:
    trend_fig = go.Figure()
    for company in selected_companies:
        if company in trend_counts.columns:
            trend_fig.add_trace(
                go.Scatter(
                    x=trend_counts.index,
                    y=trend_counts[company],
                    name=company,
                    mode="lines+markers",
                    line=dict(color=COMPANIES[company]["color"], width=2.7),
                    marker=dict(size=6),
                )
            )

    trend_fig.update_layout(
        height=420,
        margin=dict(l=20, r=20, t=20, b=20),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#ffffff",
        xaxis=dict(title="날짜", gridcolor="#e7edf7"),
        yaxis=dict(title="기사 수", gridcolor="#e7edf7"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        font=dict(color="#2a344a"),
        hovermode="x unified",
    )
    st.plotly_chart(trend_fig, use_container_width=True)

st.markdown("<div class='section-title'>감성 분석</div>", unsafe_allow_html=True)
sentiment_summary = get_sentiment_summary(df)
if not sentiment_summary.empty:
    left, right = st.columns([1, 1.15])

    with left:
        tabs = st.tabs(selected_companies)
        for tab, company in zip(tabs, selected_companies):
            with tab:
                comp = sentiment_summary[sentiment_summary["company"] == company]
                if comp.empty:
                    st.info("감성 데이터가 없습니다.")
                else:
                    pie = px.pie(
                        comp,
                        values="count",
                        names="sentiment",
                        color="sentiment",
                        color_discrete_map=SENTIMENT_COLORS,
                        hole=0.58,
                    )
                    pie.update_layout(
                        height=330,
                        margin=dict(l=10, r=10, t=10, b=10),
                        paper_bgcolor="rgba(0,0,0,0)",
                        font=dict(color="#233047"),
                    )
                    st.plotly_chart(pie, use_container_width=True)

    with right:
        bar = px.bar(
            sentiment_summary,
            x="company",
            y="ratio",
            color="sentiment",
            barmode="group",
            color_discrete_map=SENTIMENT_COLORS,
            labels={"company": "회사", "ratio": "비율(%)", "sentiment": "감성"},
        )
        bar.update_layout(
            height=380,
            margin=dict(l=15, r=15, t=18, b=15),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="#ffffff",
            xaxis=dict(gridcolor="#e7edf7"),
            yaxis=dict(gridcolor="#e7edf7"),
            font=dict(color="#233047"),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(bar, use_container_width=True)

st.markdown("<div class='section-title'>회사별 키워드</div>", unsafe_allow_html=True)
word_cols = st.columns(min(len(selected_companies), 4))
colormap_map = {"넥슨": "Blues", "NC소프트": "Oranges", "넷마블": "Greens", "크래프톤": "Purples"}

for i, company in enumerate(selected_companies):
    with word_cols[i % len(word_cols)]:
        st.markdown(f"**{company}**")
        keywords = get_keyword_data(df, company=company, top_n=30)
        if not keywords:
            st.caption("키워드가 없습니다.")
            continue

        try:
            wc = WordCloud(
                font_path="c:/Windows/Fonts/malgun.ttf",
                width=460,
                height=280,
                background_color="#0e1729",
                colormap=colormap_map.get(company, "viridis"),
                max_words=30,
                prefer_horizontal=0.72,
            )
            wc.generate_from_frequencies(dict(keywords))
            fig_wc, ax = plt.subplots(figsize=(6, 3.6))
            fig_wc.patch.set_facecolor("#0e1729")
            ax.set_facecolor("#0e1729")
            ax.imshow(wc, interpolation="bilinear")
            ax.axis("off")
            st.pyplot(fig_wc)
            plt.close(fig_wc)
        except Exception:
            top_kw = pd.DataFrame(keywords[:12], columns=["키워드", "빈도"])
            kw_bar = px.bar(
                top_kw,
                x="빈도",
                y="키워드",
                orientation="h",
                color_discrete_sequence=[COMPANIES[company]["color"]],
            )
            kw_bar.update_layout(
                height=300,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="#ffffff",
            )
            st.plotly_chart(kw_bar, use_container_width=True)

st.markdown("<div class='section-title'>최신 기사 목록</div>", unsafe_allow_html=True)
flt1, flt2 = st.columns([1, 1])
with flt1:
    filter_company = st.selectbox("회사", ["전체"] + selected_companies)
with flt2:
    filter_sentiment = st.selectbox("감성", ["전체", "긍정", "중립", "부정"])

view_df = df.copy()
if filter_company != "전체":
    view_df = view_df[view_df["company"] == filter_company]
if filter_sentiment != "전체":
    view_df = view_df[view_df["sentiment"] == filter_sentiment]

view_df = view_df.sort_values("pubDate_parsed", ascending=False)
display_df = view_df[["company", "title_clean", "sentiment", "date", "originallink"]].copy()
display_df.columns = ["회사", "제목", "감성", "날짜", "링크"]

st.dataframe(
    display_df,
    hide_index=True,
    use_container_width=True,
    height=420,
    column_config={
        "링크": st.column_config.LinkColumn("원문", display_text="기사 보기"),
        "회사": st.column_config.TextColumn("회사", width="small"),
        "감성": st.column_config.TextColumn("감성", width="small"),
        "날짜": st.column_config.TextColumn("날짜", width="small"),
    },
)

st.caption(f"필터 결과: {len(display_df)}건")

st.markdown(
    f"""
<div class="footer">
  <strong>NEXON PR 인사이트 센터</strong> · 넥슨 포트폴리오용 PR 분석 대시보드<br/>
  데이터 출처: 네이버 뉴스 검색 API · AI 감성 모델: {get_model_id()}<br/>
  Built with Streamlit · {datetime.now().year}
</div>
""",
    unsafe_allow_html=True,
)
