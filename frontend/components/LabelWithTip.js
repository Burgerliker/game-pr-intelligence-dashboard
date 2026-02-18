"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Stack, Tooltip, Typography } from "@mui/material";

export default function LabelWithTip({ label, tip, variant = "body2", fontWeight = 700 }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant={variant} sx={{ fontWeight }}>
        {label}
      </Typography>
      <Tooltip title={tip} arrow>
        <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
      </Tooltip>
    </Stack>
  );
}
