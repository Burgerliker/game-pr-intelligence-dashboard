"use client";

import { Button, Stack, Typography } from "@mui/material";

export default function EmptyState({
  title = "표시할 데이터가 없습니다.",
  subtitle = "",
  actionLabel = "",
  onAction = null,
  tone = "neutral",
  compact = false,
}) {
  const tonePalette =
    tone === "warning"
      ? {
          bg: "#fff8eb",
          border: "#f6d596",
          title: "#8a5700",
          subtitle: "#9a6c1d",
        }
      : {
          bg: "#f8fafc",
          border: "#cbd5e1",
          title: "#334155",
          subtitle: "#64748b",
        };

  return (
    <Stack
      spacing={compact ? 0.5 : 0.8}
      sx={{
        p: compact ? 1.4 : 2.2,
        borderRadius: 2,
        border: "1px dashed",
        borderColor: tonePalette.border,
        bgcolor: tonePalette.bg,
        textAlign: compact ? "left" : "center",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: tonePalette.title }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" sx={{ color: tonePalette.subtitle, whiteSpace: "pre-wrap" }}>
          {subtitle}
        </Typography>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <Stack direction="row" justifyContent="center">
          <Button variant="outlined" size="small" onClick={onAction}>
            {actionLabel}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
