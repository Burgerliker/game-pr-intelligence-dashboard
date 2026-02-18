"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";

export default function LabelWithTip({ label, tip, variant = "body2", fontWeight = 700 }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant={variant} sx={{ fontWeight }}>
        {label}
      </Typography>
      <Tooltip title={tip} arrow>
        <IconButton
          size="small"
          aria-label={`${label} 설명 보기`}
          sx={{
            width: 44,
            height: 44,
            color: "text.secondary",
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
