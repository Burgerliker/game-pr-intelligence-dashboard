"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

export default function LoadingState({ title = "로딩 중", subtitle = "데이터를 불러오고 있습니다." }) {
  return (
    <Box
      sx={{
        p: 2.2,
        border: "1px solid #dbe4ef",
        borderRadius: 2,
        bgcolor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        gap: 1.2,
      }}
    >
      <CircularProgress size={20} thickness={5} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "#334155" }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: "#64748b" }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
