"""Rule-based sentiment utilities for game PR monitoring."""

import pandas as pd

POSITIVE = "긍정"
NEUTRAL = "중립"
NEGATIVE = "부정"
DEFAULT_MODEL_ID = "rule_v2"

NEG_DICT = {
    "먹튀": 1.0,
    "소송": 1.0,
    "사기": 1.0,
    "개인정보유출": 1.0,
    "조작": 1.0,
    "논란": 0.8,
    "분노": 0.8,
    "환불": 0.8,
    "항의": 0.7,
    "버그": 0.7,
    "장애": 0.7,
    "오류": 0.7,
    "점검 장기화": 0.7,
    "불만": 0.5,
    "지적": 0.5,
    "우려": 0.5,
    "하락": 0.5,
    "감소": 0.5,
    "악재": 0.7,
    "보이콧": 0.9,
    "집단소송": 1.0,
}

POS_DICT = {
    "기대": 0.5,
    "관심": 0.4,
    "성장": 0.5,
    "증가": 0.4,
    "흥행": 0.8,
    "수상": 0.8,
    "신기록": 0.8,
    "호평": 0.8,
    "대박": 0.8,
    "역대급": 1.0,
    "글로벌1위": 1.0,
    "출시 호조": 0.8,
    "매출 증가": 0.8,
    "이용자 증가": 0.7,
    "안정화": 0.6,
    "복구 완료": 0.7,
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
    text_low = text.lower()

    pos_matches = [(keyword, weight) for keyword, weight in POS_DICT.items() if keyword in text_low]
    neg_matches = [(keyword, weight) for keyword, weight in NEG_DICT.items() if keyword in text_low]

    pos_score = float(sum(weight for _, weight in pos_matches))
    neg_score = float(sum(weight for _, weight in neg_matches))
    has_conflict = pos_score > 0 and neg_score > 0

    # "논란 + 대응/복구" 기사에서 부정 과대평가를 완화
    if neg_score > 0 and _contains_any(text_low, MITIGATION_TERMS):
        neg_score *= 0.75

    # 점수 총량으로 정규화해 과도한 포화(-1/1 고정)를 줄인다.
    denom = max(1.0, pos_score + neg_score)
    raw_score = (pos_score - neg_score) / denom
    if has_conflict:
        raw_score *= 0.85
    raw_score = max(-1.0, min(1.0, raw_score))

    matched_keywords = len(pos_matches) + len(neg_matches)
    if matched_keywords == 0:
        confidence = 0.15
    else:
        coverage = min(1.0, matched_keywords / 4.0)
        separation = min(1.0, abs(raw_score) / 0.4)
        confidence = 0.2 + (0.5 * coverage) + (0.3 * separation)
        if has_conflict:
            confidence *= 0.85
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    if raw_score <= -0.18:
        label_en = "negative"
    elif raw_score >= 0.18:
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
        "matched_positive_terms": [k for k, _ in pos_matches][:10],
        "matched_negative_terms": [k for k, _ in neg_matches][:10],
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
