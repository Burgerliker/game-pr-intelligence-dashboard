"use client";

import { AlertTriangle } from "lucide-react";

const TONE = {
  error: {
    box: "border-red-200 bg-red-50",
    title: "text-red-900",
    text: "text-red-800",
    code: "border-red-200 bg-red-100 text-red-900",
  },
  warning: {
    box: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    text: "text-amber-800",
    code: "border-amber-200 bg-amber-100 text-amber-900",
  },
  info: {
    box: "border-blue-200 bg-blue-50",
    title: "text-blue-900",
    text: "text-blue-800",
    code: "border-blue-200 bg-blue-100 text-blue-900",
  },
};

export default function ErrorState({
  title = "문제가 발생했습니다",
  details = "",
  diagnosticCode = "",
  actionLabel = "",
  onAction = null,
  tone = "error",
}) {
  const palette = TONE[tone] || TONE.error;

  return (
    <div className={`w-full rounded-2xl border px-4 py-3 ${palette.box}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-[2px] h-4 w-4" />
          <div>
            <p className={`text-sm font-bold leading-5 ${palette.title}`}>{title}</p>
            {details ? <p className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-5 ${palette.text}`}>{details}</p> : null}
            {diagnosticCode ? (
              <span className={`mt-2 inline-flex h-7 items-center rounded-full border px-2 text-xs font-bold ${palette.code}`}>
                진단코드: {diagnosticCode}
              </span>
            ) : null}
          </div>
        </div>
        {actionLabel && typeof onAction === "function" ? (
          <button type="button" onClick={onAction} className="h-10 rounded-xl border border-current px-3 text-[13px] font-semibold">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
