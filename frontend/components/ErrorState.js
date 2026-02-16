"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";

export default function ErrorState({
  title = "문제가 발생했습니다",
  details = "",
  actionLabel = "",
  onAction = null,
}) {
  return (
    <Alert
      severity="error"
      sx={{ borderRadius: 2 }}
      action={
        actionLabel && typeof onAction === "function" ? (
          <Button color="inherit" size="small" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      }
    >
      <Stack spacing={0.2}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {details ? (
          <Typography variant="caption" sx={{ whiteSpace: "pre-wrap" }}>
            {details}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}
