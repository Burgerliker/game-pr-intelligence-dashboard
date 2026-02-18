"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";

export default function ErrorState({
  title = "문제가 발생했습니다",
  details = "",
  diagnosticCode = "",
  actionLabel = "",
  onAction = null,
}) {
  return (
    <Alert
      severity="error"
      sx={{
        borderRadius: 2,
        border: "1px solid #f4b9be",
        bgcolor: "#fff4f4",
        "& .MuiAlert-icon": { mt: "2px" },
      }}
      action={
        actionLabel && typeof onAction === "function" ? (
          <Button color="inherit" size="small" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      }
    >
      <Stack spacing={0.35}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "#7f1d1d" }}>
          {title}
        </Typography>
        {details ? (
          <Typography variant="caption" sx={{ whiteSpace: "pre-wrap", color: "#9f2a2a" }}>
            {details}
          </Typography>
        ) : null}
        {diagnosticCode ? (
          <Typography variant="caption" sx={{ color: "#7f1d1d", opacity: 0.86 }}>
            진단코드: {diagnosticCode}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}
