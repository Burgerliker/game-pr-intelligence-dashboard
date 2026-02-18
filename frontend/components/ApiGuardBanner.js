"use client";

import { useEffect } from "react";
import { getApiGuardrailState } from "../lib/api";

export default function ApiGuardBanner() {
  const guard = getApiGuardrailState();

  useEffect(() => {
    if (!guard.isUnsafeLocalhost) return;
    console.warn(`[${guard.code}] production API base URL points to localhost: ${guard.resolvedBaseUrl}`);
  }, [guard.code, guard.isUnsafeLocalhost, guard.resolvedBaseUrl]);

  if (!guard.isUnsafeLocalhost) return null;

  return (
    <div
      role="alert"
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: "1px solid #f6d596",
        backgroundColor: "#fff9eb",
        padding: "10px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <svg
        style={{ width: 18, height: 18, color: "#d97706", flexShrink: 0, marginTop: 1 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: "#8a5b00", fontSize: 14, lineHeight: 1.35 }}>
          운영 API 주소 설정을 확인하세요.
        </p>
        <p style={{ margin: "3px 0 0", color: "#8b6b2d", fontSize: 12, lineHeight: 1.4 }}>
          현재 설정이 localhost를 가리켜 실데이터 연동이 실패할 수 있습니다.
        </p>
        <p style={{ margin: "2px 0 0", color: "#8b6b2d", fontSize: 12, opacity: 0.86 }}>
          진단코드: {guard.code}
        </p>
      </div>
    </div>
  );
}
