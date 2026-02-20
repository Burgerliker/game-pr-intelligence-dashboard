"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { getApiGuardrailState } from "../lib/api";

export default function ApiGuardBanner() {
  const guard = getApiGuardrailState();

  useEffect(() => {
    if (!guard.isUnsafeLocalhost) return;
    console.warn(`[${guard.code}] production API base URL points to localhost: ${guard.resolvedBaseUrl}`);
  }, [guard.code, guard.isUnsafeLocalhost, guard.resolvedBaseUrl]);

  if (!guard.isUnsafeLocalhost) return null;

  return (
    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-[2px] h-4 w-4" />
        <div>
          <p className="text-sm font-bold">운영 API 주소 설정을 확인하세요.</p>
          <p className="text-xs">현재 설정이 localhost를 가리켜 실데이터 연동이 실패할 수 있습니다.</p>
          <p className="text-xs opacity-90">진단코드: {guard.code}</p>
        </div>
      </div>
    </div>
  );
}
