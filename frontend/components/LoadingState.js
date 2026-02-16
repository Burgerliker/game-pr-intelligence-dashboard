"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

export default function LoadingState({ title = "로딩 중", subtitle = "데이터를 불러오고 있습니다." }) {
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <CircularProgress size={22} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
