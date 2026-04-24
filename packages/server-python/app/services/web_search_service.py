"""
网络搜索服务 - 从互联网获取研究上下文
"""

import aiohttp
import logging
import json
from typing import Dict, List, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# 搜索限制
MAX_SEARCH_RESULTS = 5
MAX_CONTEXT_LENGTH = 2000


async def web_search_with_provider(
    query: str,
    provider: str = "google",
    api_key: Optional[str] = None,
    pdf_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    执行网络搜索

    Args:
        query: 搜索查询
        provider: 搜索提供商
        api_key: API key
        pdf_text: PDF 文本上下文（用于增强搜索）

    Returns:
        搜索结果 {sources, context}
    """
    # 构建增强查询
    enhanced_query = query
    if pdf_text:
        # 从 PDF 中提取关键词增强搜索
        keywords = extract_keywords(pdf_text)
        if keywords:
            enhanced_query = f"{query} {keywords[:3]}"

    # 根据提供商选择搜索方法
    if provider == "serper" and api_key:
        return await search_with_serper(enhanced_query, api_key)
    elif provider == "google" and api_key:
        return await search_with_google(enhanced_query, api_key)
    else:
        # 无 API key 时返回空结果
        return {
            "sources": [],
            "context": "",
            "provider": "none"
        }


async def search_with_serper(query: str, api_key: str) -> Dict[str, Any]:
    """
    使用 Serper API 搜索
    """
    url = "https://google.serper.dev/search"

    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "q": query,
        "gl": "cn",
        "hl": "zh-cn",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Serper search error: {resp.status} - {error_text}")
                    return {"sources": [], "context": "", "error": error_text}

                data = await resp.json()
                sources = []

                # 提取有机搜索结果
                organic = data.get("organic", [])
                for item in organic[:MAX_SEARCH_RESULTS]:
                    sources.append({
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    })

                # 构建上下文摘要
                context = build_context_from_sources(sources)

                return {
                    "sources": sources,
                    "context": context,
                    "provider": "serper"
                }

    except Exception as e:
        logger.error(f"Serper search failed: {e}")
        return {"sources": [], "context": "", "error": str(e)}


async def search_with_google(query: str, api_key: str) -> Dict[str, Any]:
    """
    使用 Google Custom Search API 搜索
    """
    url = "https://www.googleapis.com/customsearch/v1"

    params = {
        "key": api_key,
        "cx": settings.GOOGLE_SEARCH_CX or "",
        "q": query,
        "num": MAX_SEARCH_RESULTS,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Google search error: {resp.status} - {error_text}")
                    return {"sources": [], "context": "", "error": error_text}

                data = await resp.json()
                sources = []

                items = data.get("items", [])
                for item in items[:MAX_SEARCH_RESULTS]:
                    sources.append({
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    })

                context = build_context_from_sources(sources)

                return {
                    "sources": sources,
                    "context": context,
                    "provider": "google"
                }

    except Exception as e:
        logger.error(f"Google search failed: {e}")
        return {"sources": [], "context": "", "error": str(e)}


def extract_keywords(text: str) -> List[str]:
    """
    从文本中提取关键词（简单实现）
    """
    if not text:
        return []

    # 移除常见停用词
    stopwords = {"的", "是", "在", "和", "了", "有", "为", "以", "及", "等", "可", "能", "这", "那"}

    # 分词（简单按空格和标点分割）
    words = []
    for part in text.split():
        # 进一步分割中文
        for char in part:
            if char.isalpha() or char.isnumeric():
                words.append(char)

    # 过滤停用词并取高频词
    filtered = [w for w in words if w not in stopwords and len(w) > 1]

    # 统计频率
    freq = {}
    for w in filtered:
        freq[w] = freq.get(w, 0) + 1

    # 按频率排序
    sorted_words = sorted(freq.keys(), key=lambda x: freq[x], reverse=True)

    return sorted_words[:5]


def build_context_from_sources(sources: List[Dict[str, Any]]) -> str:
    """
    从搜索结果构建研究上下文
    """
    if not sources:
        return ""

    context_parts = []
    for source in sources:
        snippet = source.get("snippet", "")
        title = source.get("title", "")
        if snippet:
            context_parts.append(f"【{title}】{snippet}")

    context = "\n\n".join(context_parts)

    # 截断
    if len(context) > MAX_CONTEXT_LENGTH:
        context = context[:MAX_CONTEXT_LENGTH]

    return context