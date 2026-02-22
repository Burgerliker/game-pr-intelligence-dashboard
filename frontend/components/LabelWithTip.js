"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";

export default function LabelWithTip({ label, tip, variant = "body2", fontWeight = 700, color }) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="baseline" sx={{ display: "inline-flex" }}>
      <Typography
        variant={variant}
        sx={{
          fontWeight,
          lineHeight: 1.35,
          ...(color ? { color } : null),
        }}
      >
        {label}
      </Typography>
      <Tooltip title={tip || ""} arrow>
        <span>
          <IconButton
            size="small"
            aria-label={`${label} 설명 보기`}
            sx={{
              width: 40,
              height: 40,
              minHeight: 40,
              p: 1,
              borderRadius: 1.5,
              color: "text.secondary",
              ml: -0.2,
              mt: "-6px",
              mb: "-6px",
              "&:hover": { bgcolor: "rgba(15,23,42,.06)" },
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
