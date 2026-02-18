import { getDiagnosticCode, getErrorMessage } from "./api";

function normalizeScope(scope) {
  return String(scope || "GEN")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || "GEN";
}

export function buildDiagnosticScope(page, area = "GEN") {
  const pageScope = normalizeScope(page);
  const areaScope = normalizeScope(area);
  return `${pageScope}-${areaScope}`;
}

export function toRequestErrorState(error, { scope, fallback }) {
  return {
    message: getErrorMessage(error, fallback),
    code: getDiagnosticCode(error, normalizeScope(scope)),
  };
}

export function shouldShowEmptyState({ loading, error, hasData }) {
  return !loading && !error && !hasData;
}
