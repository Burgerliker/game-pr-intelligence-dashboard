import Link from "next/link";

const NEXON_LOGO = "/nexon-logo.png";

export default function HomePage() {
  return (
    <main className="landingPage">
      <header className="landingHeader">
        <div className="landingBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <p className="landingKicker">NEXON PR</p>
        </div>
        <h1>Dashboard</h1>
      </header>

      <section className="landingPanel">
        <article className="landingCard main">
          <h3>경쟁사 비교</h3>
          <p>보도량 · 감성 · 키워드 · 리스크</p>
          <ul>
            <li>넥슨 / NC소프트 / 넷마블 / 크래프톤</li>
            <li>최신 기사 + 인사이트</li>
          </ul>
          <Link className="landingBtn primary" href="/compare">
            열기
          </Link>
        </article>

        <article className="landingCard sub">
          <h3>넥슨 IP 군집 분석</h3>
          <p>IP별 기사 군집 + 언론사/테마 대시보드</p>
          <ul>
            <li>군집별 대표 기사/키워드</li>
            <li>언론사 감성 분포 + 날짜 추이</li>
          </ul>
          <Link className="landingBtn ghost" href="/nexon">
            열기
          </Link>
        </article>
      </section>
    </main>
  );
}
