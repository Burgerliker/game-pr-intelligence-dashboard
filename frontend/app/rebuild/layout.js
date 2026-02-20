import "../globals.css";

export const metadata = {
  title: "PR Dashboard Rebuild",
};

export default function RebuildLayout({ children }) {
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}
