"use client";

import { Alert, Box, Button, Stack, Typography } from "@mui/material";

const TONE = {
  error: {
    bg: "#fff4f4",
    border: "#f4b9be",
    title: "#7f1d1d",
    text: "#9f2a2a",
    codeBg: "#ffe7ea",
    codeBorder: "#f1a8af",
  },
  warning: {
    bg: "#fff8eb",
    border: "#f6d596",
    title: "#8a5700",
    text: "#9a6c1d",
    codeBg: "#fff1cc",
    codeBorder: "#edcc84",
  },
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    text: "#334155",
    codeBg: "#e0ecff",
    codeBorder: "#b7d1ff",
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
    <Alert
      severity={tone === "warning" ? "warning" : tone === "info" ? "info" : "error"}
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: palette.border,
        bgcolor: palette.bg,
        "& .MuiAlert-icon": { mt: "2px" },
      }}
      action={
        actionLabel && typeof onAction === "function" ? (
          <Button
            color="inherit"
            size="small"
            onClick={onAction}
            sx={{ minHeight: 40, px: 1.4, borderRadius: 1.5, fontSize: 13, textTransform: "none" }}
          >
            {actionLabel}
          </Button>
        ) : null
      }
    >
      <Stack spacing={0.35}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: palette.title, lineHeight: 1.35 }}>
          {title}
        </Typography>
        {details ? (
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", color: palette.text, fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}
          >
            {details}
          </Typography>
        ) : null}
        {diagnosticCode ? (
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 28,
              px: 1,
              borderRadius: 99,
              border: "1px solid",
              borderColor: palette.codeBorder,
              bgcolor: palette.codeBg,
              color: palette.title,
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            진단코드: {diagnosticCode}
          </Box>
        ) : null}
      </Stack>
    </Alert>
  );
}
