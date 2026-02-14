"""Sentiment utilities (Hugging Face model only)."""

import os
from functools import lru_cache

import pandas as pd
from dotenv import load_dotenv
from transformers import pipeline

load_dotenv()

DEFAULT_MODEL_ID = os.getenv("HF_SENTIMENT_MODEL", "nlptown/bert-base-multilingual-uncased-sentiment")

POSITIVE = "긍정"
NEUTRAL = "중립"
NEGATIVE = "부정"


@lru_cache(maxsize=4)
def _load_classifier(model_id: str):
    """Load and cache HF text-classification pipeline."""
    return pipeline("text-classification", model=model_id, tokenizer=model_id)


def get_model_id() -> str:
    """Return active sentiment model id."""
    return DEFAULT_MODEL_ID


def _map_label_to_sentiment(label: str, score: float) -> str:
    """Map model label to POSITIVE/NEUTRAL/NEGATIVE."""
    label_l = (label or "").lower()

    # Common pattern: LABEL_0/1/2
    if "label_" in label_l:
        try:
            idx = int(label_l.split("label_")[-1])
            if idx <= 0:
                return NEGATIVE
            if idx == 1:
                return NEUTRAL
            return POSITIVE
        except ValueError:
            pass

    # Common text labels / stars
    if any(token in label_l for token in ["5", "4", "positive", "pos", "good", "bullish"]):
        return POSITIVE
    if any(token in label_l for token in ["1", "2", "negative", "neg", "bad", "bearish"]):
        return NEGATIVE
    if any(token in label_l for token in ["3", "neutral", "neu"]):
        return NEUTRAL

    # Fallback by confidence score only (still AI-only)
    if score >= 0.66:
        return POSITIVE
    if score <= 0.33:
        return NEGATIVE
    return NEUTRAL


def analyze_sentiment_ai(text: str, model_id: str | None = None) -> str:
    """Run AI sentiment analysis for a single text."""
    model = model_id or DEFAULT_MODEL_ID
    classifier = _load_classifier(model)
    pred = classifier(text, truncation=True, max_length=256)[0]
    return _map_label_to_sentiment(pred.get("label", ""), float(pred.get("score", 0.5)))


def add_sentiment_column(df: pd.DataFrame, model_id: str | None = None) -> pd.DataFrame:
    """Add AI sentiment column to DataFrame."""
    if df.empty:
        return df

    out = df.copy()
    out["text_combined"] = out["title_clean"].fillna("") + " " + out["description_clean"].fillna("")
    out["sentiment"] = out["text_combined"].apply(lambda txt: analyze_sentiment_ai(txt, model_id=model_id))
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
