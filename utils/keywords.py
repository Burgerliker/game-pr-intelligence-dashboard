"""키워드 추출 유틸리티"""

import re
from collections import Counter

import pandas as pd

# 불용어 (분석에서 제외할 일반적인 단어)
STOPWORDS = {
    "있다", "하는", "되는", "이번", "대한", "이후", "통해", "위해",
    "하고", "에서", "으로", "까지", "부터", "라고", "했다", "된다",
    "한다", "것으로", "이라고", "밝혔다", "전했다", "말했다", "보도",
    "기자", "뉴스", "관련", "지난", "올해", "내년", "최근", "현재",
    "오늘", "어제", "내일", "것이", "수도", "등을", "것을", "하며",
    "또한", "있는", "없는", "같은", "따른", "관한", "의한",
    # 회사명 자체는 키워드에서 제외
    "넥슨", "엔씨소프트", "NC소프트", "넷마블", "크래프톤",
    "넥슨게임즈", "넷마블게임즈",
}


def extract_keywords(texts: list[str], top_n: int = 50) -> list[tuple[str, int]]:
    """텍스트 목록에서 주요 키워드를 추출

    한국어 2글자 이상 단어를 정규식으로 추출하는 간이 방식.
    형태소 분석기 없이도 기사 제목/요약에서 핵심 키워드를 잡아냄.
    """
    word_counter = Counter()

    for text in texts:
        # 한글 2~6글자 단어 추출
        words = re.findall(r"[가-힣]{2,6}", text)
        for word in words:
            if word not in STOPWORDS:
                word_counter[word] += 1

    return word_counter.most_common(top_n)


def get_keyword_data(df: pd.DataFrame, company: str | None = None, top_n: int = 40) -> list[tuple[str, int]]:
    """DataFrame에서 특정 회사(또는 전체)의 키워드 추출"""
    if df.empty:
        return []

    if company:
        subset = df[df["company"] == company]
    else:
        subset = df

    texts = (subset["title_clean"] + " " + subset["description_clean"]).tolist()
    return extract_keywords(texts, top_n=top_n)
