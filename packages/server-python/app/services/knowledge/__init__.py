"""
知识服务模块
"""

from app.services.knowledge.extractor import extract_knowledge_points, categorize_knowledge

__all__ = ["extract_knowledge_points", "categorize_knowledge"]