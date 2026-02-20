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
    tone === "info"
      ? {
          bg: "#eff6ff",
          border: "#bfdbfe",
          title: "#1e3a8a",
          subtitle: "#334155",
        }
      : tone === "error"
        ? {
            bg: "#fff4f4",
            border: "#f4b9be",
            title: "#7f1d1d",
            subtitle: "#9f2a2a",
          }
        :
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
        px: compact ? 1.2 : 1.6,
        py: compact ? 1 : 1.5,
        minHeight: compact ? 40 : 44,
        borderRadius: 2,
        border: "1px solid",
        borderColor: tonePalette.border,
        bgcolor: tonePalette.bg,
        textAlign: compact ? "left" : "center",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: tonePalette.title, lineHeight: 1.35 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography
          variant="body2"
          sx={{ color: tonePalette.subtitle, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}
        >
          {subtitle}
        </Typography>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <Stack direction="row" justifyContent={compact ? "flex-start" : "center"}>
          <Button
            variant="outlined"
            size="small"
            onClick={onAction}
            sx={{ minHeight: 40, px: 1.5, borderRadius: 1.5, fontSize: 13, textTransform: "none", fontVariantNumeric: "tabular-nums" }}
          >
            {actionLabel}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
