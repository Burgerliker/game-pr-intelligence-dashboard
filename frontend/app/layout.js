import "./globals.css";

export const metadata = {
  title: "NEXON PR 인사이트 센터",
  description: "NEXON 포트폴리오용 PR 분석 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

