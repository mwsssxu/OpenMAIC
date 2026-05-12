"""
精确排版Prompt模板 - 幻灯片内容生成（简化版）

简化版系统提示，减少生成耗时
"""

# 文本高度查表 (line-height=1.5, 包含10px上下padding)
TEXT_HEIGHT_TABLE = {
    14: [43, 64, 85, 106, 127],
    16: [46, 70, 94, 118, 142],
    18: [49, 76, 103, 130, 157],
    20: [52, 82, 112, 142, 172],
    24: [58, 94, 130, 166, 202],
    28: [64, 106, 148, 190, 232],
    32: [70, 118, 166, 214, 262],
    36: [76, 130, 184, 238, 292],
}


def get_text_height(font_size: int, line_count: int) -> int:
    """从查表获取文本高度"""
    sizes = TEXT_HEIGHT_TABLE.get(font_size)
    if sizes and 1 <= line_count <= 5:
        return sizes[line_count - 1]
    return int(line_count * font_size * 1.5 + 20)


# 系统Prompt模板（简化版 - 减少生成耗时）
SLIDE_CONTENT_SYSTEM_PROMPT = """生成幻灯片JSON。Canvas:1000x562.5,边距≥50。

TextElement: id,type,left,top,width,height,content,defaultColor
- height必须查表: 14px[43,64,85,106,127] 16px[46,70,94,118,142] 18px[49,76,103,130,157] 20px[52,82,112,142,172] 24px[58,94,130,166,202] 28px[64,106,148,190,232] 32px[70,118,166,214,262] 36px[76,130,184,238,292]
- content支持HTML: <p>,<strong>,font-size,color
- 禁止LaTeX

ShapeElement: id,type,left,top,width,height,path,viewBox,fill,fixedRatio
- 矩形path:"M 0 0 L 1 0 L 1 1 L 0 1 Z",viewBox:[1,1]

LatexElement: id,type,left,top,width,height,latex,color

规则:文本宽度=(width-20)/font_size,对齐居中,间距30-50px,字号标题32-36px要点18-20px
禁止:教师个性化内容,口语句子,估算高度(如70,80)

只输出JSON:{"type":"slide","canvas":{"width":1000,"height":562.5,"background":{"color":"#ffffff"},"elements":[...]}}"""


# 用户Prompt模板
SLIDE_CONTENT_USER_TEMPLATE = """生成幻灯片:
标题: {title}
类型: {type}
描述: {description}
要点: {key_points}
{teacher_context}
语言: {language}

要求:精确排版,背景装饰shape,内容简洁
输出JSON,无其他内容。"""