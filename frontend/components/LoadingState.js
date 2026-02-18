"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

const TONE = {
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    subtitle: "#334155",
    spinner: "#2563eb",
  },
  warning: {
    bg: "#fff9eb",
    border: "#f9d48f",
    title: "#8a5b00",
    subtitle: "#8b6b2d",
    spinner: "#d97706",
  },
};

export default function LoadingState({
  title = "로딩 중",
  subtitle = "데이터를 불러오고 있습니다.",
  tone = "info",
}) {
  const palette = TONE[tone] || TONE.info;

  return (
    <Box
      sx={{
        px: 1.4,
        py: 1.2,
        minHeight: 44,
        border: "1px solid",
        borderColor: palette.border,
        borderRadius: 2,
        bgcolor: palette.bg,
        display: "flex",
        alignItems: "center",
        gap: 1.1,
      }}
    >
      <CircularProgress size={18} thickness={5} sx={{ color: palette.spinner }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: palette.title, lineHeight: 1.35 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: palette.subtitle, fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
