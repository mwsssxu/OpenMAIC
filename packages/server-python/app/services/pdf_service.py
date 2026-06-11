"""
PDF 解析服务 - 提取文本和图像
"""

import logging
import base64
import io
from typing import Dict, List, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# PDF 内容限制
MAX_PDF_TEXT_CHARS = 50000
MAX_PDF_IMAGES = 10
# Vision OCR 最多处理的页数（控制成本）
MAX_VISION_PAGES = 5


async def parse_pdf_with_pypdf(
    pdf_bytes: bytes,
    provider_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    使用 PyPDF 解析 PDF（基础方案）
    如果文本为空（图片型PDF），自动切换到 LLM Vision OCR
    """
    try:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        images = []
        pdf_images_metadata = []

        for page_num, page in enumerate(reader.pages):
            # 提取文本
            page_text = page.extract_text() or ""
            if page_text:
                text_parts.append(f"[Page {page_num + 1}]\n{page_text}")

            # 提取图像
            if hasattr(page, "images"):
                for img_idx, img in enumerate(page.images[:MAX_PDF_IMAGES]):
                    try:
                        img_data = img.data
                        img_base64 = base64.b64encode(img_data).decode("utf-8")

                        img_ext = "png"
                        if img.name and img.name.lower().endswith(".jpg"):
                            img_ext = "jpg"

                        images.append(f"data:image/{img_ext};base64,{img_base64}")
                        pdf_images_metadata.append({
                            "id": f"img_{page_num}_{img_idx}",
                            "pageNumber": page_num + 1,
                            "width": getattr(img, "width", None),
                            "height": getattr(img, "height", None),
                        })
                    except Exception as e:
                        logger.warning(f"Failed to extract image {img_idx} from page {page_num}: {e}")

        full_text = "\n\n".join(text_parts)

        # 图片型PDF检测：有页数但文本为空，且提取到图片
        is_image_pdf = len(reader.pages) > 0 and len(full_text.strip()) == 0 and len(images) > 0

        if is_image_pdf:
            logger.info(f"Detected image-based PDF ({len(reader.pages)} pages, 0 text), switching to LLM Vision OCR")
            ocr_result = await _ocr_with_vision(pdf_bytes, api_key, base_url)
            if ocr_result:
                return ocr_result
            # OCR 失败，返回带提示的空文本
            full_text = "[此PDF为图片格式，无法提取文本。请尝试上传文本型PDF或手动输入内容。]"

        # 截断文本
        if len(full_text) > MAX_PDF_TEXT_CHARS:
            full_text = full_text[:MAX_PDF_TEXT_CHARS]
            logger.info(f"PDF text truncated to {MAX_PDF_TEXT_CHARS} chars")

        return {
            "text": full_text,
            "images": images[:MAX_PDF_IMAGES],
            "metadata": {
                "total_pages": len(reader.pages),
                "pdfImages": pdf_images_metadata[:MAX_PDF_IMAGES],
                "parse_method": "pypdf" if not is_image_pdf else "pypdf+vision-ocr",
            }
        }

    except ImportError:
        logger.warning("pypdf not installed, using fallback")
        return await parse_pdf_fallback(pdf_bytes)
    except Exception as e:
        logger.error(f"PyPDF parse failed: {e}")
        raise


async def _ocr_with_vision(
    pdf_bytes: bytes,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    使用 LLM Vision API 对图片型 PDF 做 OCR
    1. 用 pypdf 提取每页图片
    2. 将图片发给视觉模型提取文本
    """
    try:
        import pypdf
        import httpx

        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)

        # 提取每页图片的 base64
        page_images: List[str] = []
        for page_num, page in enumerate(reader.pages[:MAX_VISION_PAGES]):
            if not hasattr(page, "images"):
                continue
            for img in page.images:
                try:
                    img_data = img.data
                    img_base64 = base64.b64encode(img_data).decode("utf-8")
                    # 检测图片格式
                    img_ext = "png"
                    if img.name and img.name.lower().endswith(".jpg"):
                        img_ext = "jpg"
                    page_images.append(f"data:image/{img_ext};base64,{img_base64}")
                    break  # 每页只取第一张图
                except Exception as e:
                    logger.warning(f"Failed to extract image from page {page_num}: {e}")

        if not page_images:
            logger.warning("No images extracted for Vision OCR")
            return None

        # 调用 LLM Vision API
        effective_api_key = api_key or settings.OPENAI_API_KEY
        effective_base_url = base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1"

        if not effective_api_key:
            logger.warning("No API key available for Vision OCR")
            return None

        all_text_parts = []

        # 分批处理（每批1页，避免请求过大和超时）
        batch_size = 1
        for batch_start in range(0, len(page_images), batch_size):
            batch = page_images[batch_start:batch_start + batch_size]
            batch_end = min(batch_start + batch_size, len(page_images))
            page_range = f"{batch_start + 1}-{batch_end}"

            content_parts = [{
                "type": "text",
                "text": f"请提取以下PDF页面（第{page_range}页，共{total_pages}页）中的所有文字内容。只输出提取的文字，不要添加解释。保持原文的段落结构。"
            }]
            for img_data_uri in batch:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": img_data_uri}
                })

            payload = {
                "model": "qwen-vl-max",
                "messages": [{
                    "role": "user",
                    "content": content_parts
                }],
                "max_tokens": 4000,
            }

            headers = {
                "Authorization": f"Bearer {effective_api_key}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{effective_base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )

                if resp.status_code != 200:
                    logger.error(f"Vision API error: {resp.status_code} {resp.text[:200]}")
                    continue

                result = resp.json()
                ocr_text = result["choices"][0]["message"]["content"]
                all_text_parts.append(f"[Page {page_range}]\n{ocr_text}")

            logger.info(f"Vision OCR batch {page_range} done, text_len={len(all_text_parts[-1])}")

        if not all_text_parts:
            return None

        full_text = "\n\n".join(all_text_parts)
        if len(full_text) > MAX_PDF_TEXT_CHARS:
            full_text = full_text[:MAX_PDF_TEXT_CHARS]

        return {
            "text": full_text,
            "images": [],
            "metadata": {
                "total_pages": total_pages,
                "parse_method": "vision-ocr",
                "ocr_pages": len(page_images),
            }
        }

    except Exception as e:
        logger.error(f"Vision OCR failed: {e}")
        return None


async def parse_pdf_fallback(pdf_bytes: bytes) -> Dict[str, Any]:
    """PDF 解析降级方案（无依赖库时返回空结果）"""
    return {
        "text": "",
        "images": [],
        "metadata": {
            "total_pages": 0,
            "parse_method": "fallback",
            "error": "No PDF parser available"
        }
    }


async def parse_pdf_with_llm_vision(
    pdf_bytes: bytes,
    api_key: str,
    base_url: str,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """使用 LLM Vision API 解析 PDF（高级方案）"""
    result = await _ocr_with_vision(pdf_bytes, api_key, base_url)
    if result:
        return result
    # OCR 失败，回退到 pypdf
    logger.warning("LLM Vision OCR failed, falling back to pypdf")
    return await parse_pdf_with_pypdf(pdf_bytes)


async def parse_pdf(
    pdf_bytes: bytes,
    provider_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    解析 PDF 文件（智能选择解析器）
    - pypdf: 直接提取文本层（文本型PDF）
    - llm-vision: 强制使用 Vision OCR（图片型PDF）
    - 自动检测: 如果 pypdf 提取文本为空，自动切换 Vision OCR
    """
    if provider_id == "llm-vision" and api_key and base_url:
        return await parse_pdf_with_llm_vision(
            pdf_bytes, api_key, base_url
        )
    else:
        return await parse_pdf_with_pypdf(
            pdf_bytes, provider_id, api_key, base_url
        )
