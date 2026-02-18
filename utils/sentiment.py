"""Rule-based sentiment utilities for game PR monitoring."""

import pandas as pd

POSITIVE = "긍정"
NEUTRAL = "중립"
NEGATIVE = "부정"
DEFAULT_MODEL_ID = "rule_v1"

NEG_DICT = {
    "먹튀": 1.0,
    "소송": 1.0,
    "사기": 1.0,
    "개인정보유출": 1.0,
    "논란": 0.7,
    "분노": 0.7,
    "환불": 0.7,
    "항의": 0.7,
    "버그": 0.7,
    "장애": 0.7,
    "오류": 0.7,
    "불만": 0.4,
    "지적": 0.4,
    "우려": 0.4,
    "하락": 0.4,
    "감소": 0.4,
}

POS_DICT = {
    "기대": 0.4,
    "관심": 0.4,
    "성장": 0.4,
    "증가": 0.4,
    "흥행": 0.7,
    "수상": 0.7,
    "신기록": 0.7,
    "호평": 0.7,
    "대박": 0.7,
    "역대급": 1.0,
    "글로벌1위": 1.0,
}

MITIGATION_TERMS = ["개선", "해결", "대응", "조치", "보상안", "재발방지", "정상화", "복구"]


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def get_model_id() -> str:
    """Return active sentiment method id."""
    return DEFAULT_MODEL_ID


def _label_kr(label_en: str) -> str:
    if label_en == "negative":
        return NEGATIVE
    if label_en == "positive":
        return POSITIVE
    return NEUTRAL


def analyze_sentiment_rule_v1(title: str, description: str = "") -> dict:
    text = f"{title or ''} {description or ''}".strip()

    pos_score = sum(weight for keyword, weight in POS_DICT.items() if keyword in text)
    neg_score = sum(weight for keyword, weight in NEG_DICT.items() if keyword in text)

    # "환불/논란 + 개선/해결" 유형은 순수 부정으로 과대평가하지 않도록 감쇄
    if neg_score > 0 and _contains_any(text, MITIGATION_TERMS):
        neg_score *= 0.5

    raw_score = max(-1.0, min(1.0, pos_score - neg_score))

    matched_keywords = sum(1 for keyword in POS_DICT if keyword in text) + sum(1 for keyword in NEG_DICT if keyword in text)
    has_conflict = pos_score > 0 and neg_score > 0
    confidence = 1.0
    if matched_keywords == 0:
        confidence *= 0.3
    if has_conflict:
        confidence *= 0.5
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    if raw_score <= -0.3:
        label_en = "negative"
    elif raw_score >= 0.3:
        label_en = "positive"
    else:
        label_en = "neutral"

    return {
        "sentiment_score": round(float(raw_score), 3),
        "sentiment_label": label_en,
        "sentiment_kr": _label_kr(label_en),
        "confidence": confidence,
        "method": DEFAULT_MODEL_ID,
        "matched_keywords": int(matched_keywords),
        "has_conflict": bool(has_conflict),
    }


def add_sentiment_column(df: pd.DataFrame, model_id: str | None = None) -> pd.DataFrame:
    """Add rule-based sentiment column to DataFrame."""
    if df.empty:
        return df

    out = df.copy()
    analyzed = out.apply(
        lambda row: analyze_sentiment_rule_v1(
            str(row.get("title_clean", "") or ""),
            str(row.get("description_clean", "") or ""),
        ),
        axis=1,
    )
    out["sentiment"] = analyzed.apply(lambda x: x["sentiment_kr"])
    out["sentiment_score"] = analyzed.apply(lambda x: x["sentiment_score"])
    out["sentiment_label_en"] = analyzed.apply(lambda x: x["sentiment_label"])
    out["sentiment_confidence"] = analyzed.apply(lambda x: x["confidence"])
    out["sentiment_method"] = analyzed.apply(lambda x: x["method"])
    return out


def get_sentiment_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Summarize sentiment ratio by company."""
    if df.empty:
        return pd.DataFrame()

    summary = df.groupby(["company", "sentiment"]).size().reset_index(name="count")
    total = df.groupby("company").size().reset_index(name="total")
    summary = summary.merge(total, on="company")
    summary["ratio"] = (summary["count"] / summary["total"] * 100).round(1)
    return summary
