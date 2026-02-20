"use client";

import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export default function PageStatusView({ loading, error, empty, spacing = 1.2 }) {
  const showLoading = Boolean(loading?.show);
  const showError = Boolean(error?.show);
  const showEmpty = Boolean(empty?.show);

  if (!showLoading && !showError && !showEmpty) return null;

  return (
    <div className="w-full" style={{ display: "grid", gap: `${spacing * 8}px` }}>
      {showLoading ? (
        <LoadingState
          title={loading?.title || "로딩 중"}
          subtitle={loading?.subtitle || "데이터를 불러오고 있습니다."}
          tone={loading?.tone || "info"}
        />
      ) : null}
      {showError ? (
        <ErrorState
          title={error?.title || "문제가 발생했습니다"}
          details={error?.details || ""}
          diagnosticCode={error?.diagnosticCode || ""}
          actionLabel={error?.actionLabel || ""}
          onAction={error?.onAction || null}
          tone={error?.tone || "error"}
        />
      ) : null}
      {showEmpty ? (
        <EmptyState
          title={empty?.title || "표시할 데이터가 없습니다."}
          subtitle={empty?.subtitle || ""}
          actionLabel={empty?.actionLabel || ""}
          onAction={empty?.onAction || null}
          tone={empty?.tone || "neutral"}
          compact={Boolean(empty?.compact)}
        />
      ) : null}
    </div>
  );
}
