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


async def parse_pdf_with_pypdf(
    pdf_bytes: bytes,
    provider_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    使用 PyPDF 解析 PDF（基础方案）

    Args:
        pdf_bytes: PDF 文件字节
        provider_id: 可选的 OCR provider
        api_key: OCR API key
        base_url: OCR API base URL

    Returns:
        解析结果 {text, images, metadata}
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
                        # 获取图像数据
                        img_data = img.data
                        img_base64 = base64.b64encode(img_data).decode("utf-8")

                        # 确定图像类型
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
                "parse_method": "pypdf",
            }
        }

    except ImportError:
        logger.warning("pypdf not installed, using fallback")
        return await parse_pdf_fallback(pdf_bytes)
    except Exception as e:
        logger.error(f"PyPDF parse failed: {e}")
        raise


async def parse_pdf_fallback(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    PDF 解析降级方案（无依赖库时返回空结果）
    """
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
    """
    使用 LLM Vision API 解析 PDF（高级方案）

    Args:
        pdf_bytes: PDF 文件字节
        api_key: API key
        base_url: API base URL
        model: Vision model

    Returns:
        解析结果 {text, images, metadata}
    """
    # TODO: 实现 LLM Vision 解析
    # 1. 将 PDF 页转换为图像
    # 2. 使用 Vision API 提取文本和描述图像
    # 3. 返回结构化结果

    logger.warning("LLM Vision PDF parsing not implemented, using PyPDF")
    return await parse_pdf_with_pypdf(pdf_bytes)


async def parse_pdf(
    pdf_bytes: bytes,
    provider_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    解析 PDF 文件（智能选择解析器）

    Args:
        pdf_bytes: PDF 文件字节
        provider_id: 解析器类型 (pypdf, llm-vision)
        api_key: API key (for LLM Vision)
        base_url: API base URL (for LLM Vision)

    Returns:
        解析结果
    """
    if provider_id == "llm-vision" and api_key and base_url:
        return await parse_pdf_with_llm_vision(
            pdf_bytes, api_key, base_url
        )
    else:
        return await parse_pdf_with_pypdf(
            pdf_bytes, provider_id, api_key, base_url
        )