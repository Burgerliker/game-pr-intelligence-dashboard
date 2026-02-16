from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class BurstDecision:
    ip_id: str
    mode: str
    interval_seconds: int
    changed: bool
    event_type: str | None
    trigger_reason: str | None
    burst_remaining: int | None


class BurstManager:
    def __init__(
        self,
        ip_id: str,
        *,
        base_interval: int = 600,
        burst_interval: int = 120,
        max_burst_duration: int = 7200,
    ) -> None:
        self.ip_id = ip_id
        self.mode = "base"
        self.base_interval = int(base_interval)
        self.burst_interval = int(burst_interval)
        self.max_burst_duration = int(max_burst_duration)
        self.burst_entered_at: datetime | None = None

    def _remaining_seconds(self, now: datetime) -> int | None:
        if self.mode != "burst" or not self.burst_entered_at:
            return None
        used = int((now - self.burst_entered_at).total_seconds())
        return max(0, self.max_burst_duration - used)

    def evaluate(
        self,
        *,
        current_risk: float,
        is_volume_spike: bool,
        sustained_low_30m: bool,
        now: datetime | None = None,
    ) -> BurstDecision:
        now = now or datetime.utcnow()
        previous_mode = self.mode
        event_type: str | None = None
        trigger_reason: str | None = None

        should_enter = current_risk >= 70.0 or is_volume_spike
        hard_cap_hit = False
        if self.mode == "burst" and self.burst_entered_at:
            hard_cap_hit = int((now - self.burst_entered_at).total_seconds()) >= self.max_burst_duration

        if self.mode == "base" and should_enter:
            self.mode = "burst"
            self.burst_entered_at = now
            event_type = "enter"
            trigger_reason = "risk_70" if current_risk >= 70.0 else "volume_spike"
        elif self.mode == "burst" and (sustained_low_30m or hard_cap_hit):
            self.mode = "base"
            self.burst_entered_at = None
            event_type = "exit"
            trigger_reason = "hard_cap" if hard_cap_hit else "sustained_low"

        interval = self.burst_interval if self.mode == "burst" else self.base_interval
        return BurstDecision(
            ip_id=self.ip_id,
            mode=self.mode,
            interval_seconds=interval,
            changed=(self.mode != previous_mode),
            event_type=event_type,
            trigger_reason=trigger_reason,
            burst_remaining=self._remaining_seconds(now),
        )
