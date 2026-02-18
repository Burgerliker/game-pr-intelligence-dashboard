"use client";

import { Button, Stack, Typography } from "@mui/material";

export default function EmptyState({
  title = "표시할 데이터가 없습니다.",
  subtitle = "",
  actionLabel = "",
  onAction = null,
}) {
  return (
    <Stack
      spacing={0.8}
      sx={{
        p: 2.2,
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "#f8fafc",
        textAlign: "center",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
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
