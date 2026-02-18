const DEFAULT_TIMEOUT_MS = 12000;
const LOCALHOST_HOST_RE = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0)$/i;

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizePath(path) {
  const p = String(path || "");
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function getEnvBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ""
  );
}

export function getApiBaseUrl() {
  const configured = trimTrailingSlash(getEnvBaseUrl());
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return "";
}

export function getApiGuardrailState() {
  const envBaseUrl = trimTrailingSlash(getEnvBaseUrl());
  const resolvedBaseUrl = getApiBaseUrl();
  const isProduction = process.env.NODE_ENV === "production";
  if (!resolvedBaseUrl) {
    return {
      isProduction,
      envBaseUrl,
      resolvedBaseUrl,
      isUnsafeLocalhost: false,
      code: "",
    };
  }
  try {
    const parsed = new URL(resolvedBaseUrl);
    const host = parsed.hostname || "";
    const isUnsafeLocalhost = isProduction && LOCALHOST_HOST_RE.test(host);
    return {
      isProduction,
      envBaseUrl,
      resolvedBaseUrl,
      isUnsafeLocalhost,
      code: isUnsafeLocalhost ? "API-BASE-LOCALHOST-PROD" : "",
    };
  } catch {
    return {
      isProduction,
      envBaseUrl,
      resolvedBaseUrl,
      isUnsafeLocalhost: false,
      code: "",
    };
  }
}

export function buildApiUrl(path) {
  const normalizedPath = normalizePath(path);
  const base = getApiBaseUrl();
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
}

class HttpError extends Error {
  constructor(message, status, url, body, retryAfter = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

function attachAbortSignal(signal, controller) {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort();
    return () => {};
  }
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

function isRetriableNetworkError(error) {
  if (!error) return false;
  if (error.name === "AbortError") return false;
  return (
    error instanceof TypeError ||
    /network|failed to fetch|load failed/i.test(String(error.message || error))
  );
}

function parseRetryAfter(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.ceil(asNumber);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  const sec = Math.ceil((asDate.getTime() - Date.now()) / 1000);
  return sec > 0 ? sec : null;
}

function extractErrorMessageFromPayload(data, status) {
  if (!data || typeof data !== "object") return `요청 실패 (${status})`;
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const fromDetail = detail?.message || detail?.error || detail?.reason;
    if (typeof fromDetail === "string" && fromDetail.trim()) return fromDetail;
  }
  const base = data?.message || data?.error || data?.reason;
  if (typeof base === "string" && base.trim()) return base;
  return `요청 실패 (${status})`;
}

function parseErrorPayload(text) {
  if (!text) return { data: null, raw: "" };
  try {
    return { data: JSON.parse(text), raw: text };
  } catch {
    return { data: null, raw: text };
  }
}

async function request(path, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    signal,
    headers,
    ...rest
  } = options;
  const url = buildApiUrl(path);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const detach = attachAbortSignal(signal, controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: {
          Accept: "application/json",
          ...headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        const rawText = await res.text();
        const parsed = parseErrorPayload(rawText);
        const message =
          parsed.data != null
            ? extractErrorMessageFromPayload(parsed.data, res.status)
            : (rawText || `요청 실패 (${res.status})`);
        throw new HttpError(
          message,
          res.status,
          url,
          { raw: parsed.raw, data: parsed.data },
          retryAfter
        );
      }

      if (res.status === 204) return null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return res.json();
      }
      return res.text();
    } catch (error) {
      if (attempt < retries && isRetriableNetworkError(error)) continue;
      if (error?.name === "AbortError") {
        if (signal?.aborted) throw error;
        const timeoutError = new Error("요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
        timeoutError.name = "TimeoutError";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      detach();
    }
  }
  return null;
}

export function getErrorMessage(error, fallback = "요청 처리 중 오류가 발생했습니다.") {
  if (!error) return fallback;
  if (error instanceof HttpError && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getDiagnosticCode(error, scope = "GEN") {
  const normalizedScope = String(scope || "GEN").toUpperCase();
  if (!error) return `${normalizedScope}-UNKNOWN`;
  const status = Number(error?.status || 0);
  if (status > 0) return `${normalizedScope}-HTTP-${status}`;
  if (error?.name === "TimeoutError") return `${normalizedScope}-TIMEOUT`;
  if (error?.name === "AbortError") return `${normalizedScope}-ABORT`;
  if (error instanceof TypeError) return `${normalizedScope}-NETWORK`;
  return `${normalizedScope}-UNKNOWN`;
}

export function getRetryAfterSeconds(error) {
  if (!error) return null;
  const topLevel = Number(error?.retryAfter);
  if (Number.isFinite(topLevel) && topLevel > 0) return Math.ceil(topLevel);
  const retryFromDetail = Number(error?.body?.data?.detail?.retry_after);
  if (Number.isFinite(retryFromDetail) && retryFromDetail > 0) return Math.ceil(retryFromDetail);
  return null;
}

export async function apiGet(path, options = {}) {
  return request(path, {
    method: "GET",
    retries: 1,
    ...options,
  });
}

export async function apiPost(path, body, options = {}) {
  const { headers: optionHeaders, ...restOptions } = options;
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(optionHeaders || {}),
    },
    body: JSON.stringify(body || {}),
    ...restOptions,
  });
}
