import "./globals.css";

export const metadata = {
  title: "PR Portfolio",
  description: "게임 PR 리스크 분석 포트폴리오",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
