"use client";

const TONE = {
  neutral: {
    box: "border-slate-300 bg-slate-50",
    title: "text-slate-700",
    subtitle: "text-slate-500",
  },
  info: {
    box: "border-blue-200 bg-blue-50",
    title: "text-blue-900",
    subtitle: "text-blue-800",
  },
  warning: {
    box: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    subtitle: "text-amber-800",
  },
  error: {
    box: "border-red-200 bg-red-50",
    title: "text-red-900",
    subtitle: "text-red-800",
  },
};

export default function EmptyState({
  title = "표시할 데이터가 없습니다.",
  subtitle = "",
  actionLabel = "",
  onAction = null,
  tone = "neutral",
  compact = false,
}) {
  const palette = TONE[tone] || TONE.neutral;

  return (
    <div className={`w-full rounded-2xl border ${compact ? "px-3 py-2" : "px-4 py-3"} ${palette.box}`}>
      <p className={`text-sm font-bold leading-5 ${palette.title}`}>{title}</p>
      {subtitle ? <p className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-5 ${palette.subtitle}`}>{subtitle}</p> : null}
      {actionLabel && typeof onAction === "function" ? (
        <button type="button" onClick={onAction} className="mt-2 h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
