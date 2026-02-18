"use client";

import { useEffect } from "react";
import { Alert, Typography } from "@mui/material";
import { getApiGuardrailState } from "../lib/api";

export default function ApiGuardBanner() {
  const guard = getApiGuardrailState();

  useEffect(() => {
    if (!guard.isUnsafeLocalhost) return;
    console.warn(`[${guard.code}] production API base URL points to localhost: ${guard.resolvedBaseUrl}`);
  }, [guard.code, guard.isUnsafeLocalhost, guard.resolvedBaseUrl]);

  if (!guard.isUnsafeLocalhost) return null;

  return (
    <Alert severity="warning" sx={{ mt: 1.2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        운영 API 주소 설정을 확인하세요.
      </Typography>
      <Typography variant="caption" sx={{ display: "block" }}>
        현재 설정이 localhost를 가리켜 실데이터 연동이 실패할 수 있습니다.
      </Typography>
      <Typography variant="caption" sx={{ display: "block", opacity: 0.86 }}>
        진단코드: {guard.code}
      </Typography>
    </Alert>
  );
}
