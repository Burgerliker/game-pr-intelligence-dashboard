"use client";

const TONE = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    title: "text-blue-900",
    subtitle: "text-slate-700",
    spinner: "border-blue-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    title: "text-amber-900",
    subtitle: "text-amber-800",
    spinner: "border-amber-600",
  },
};

export default function LoadingState({
  title = "로딩 중",
  subtitle = "데이터를 불러오고 있습니다.",
  tone = "info",
}) {
  const palette = TONE[tone] || TONE.info;

  return (
    <div className={`w-full rounded-2xl border px-4 py-3 ${palette.bg} ${palette.border}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-transparent border-t-current ${palette.spinner}`} />
        <div>
          <p className={`text-sm font-bold leading-5 ${palette.title}`}>{title}</p>
          <p className={`text-[13px] leading-5 ${palette.subtitle}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
