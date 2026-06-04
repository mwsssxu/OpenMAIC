"""
课程 PDF 导出服务 - 使用 ReportLab 生成排版精美的课程 PDF
"""

import io
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
    PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ──── 颜色 ────

C_PRIMARY = HexColor('#c45a1a')
C_PRIMARY_LIGHT = HexColor('#fde8e0')
C_SECONDARY = HexColor('#1a8a8a')
C_SECONDARY_LIGHT = HexColor('#e8f5f5')
C_GOLD = HexColor('#f59e0b')
C_GOLD_LIGHT = HexColor('#fef3c7')
C_FG = HexColor('#1a1a1a')
C_MUTED = HexColor('#666666')
C_BORDER = HexColor('#e2e8f0')
C_BG = HexColor('#f8f6f6')
C_WHITE = HexColor('#ffffff')
C_NOTE_CORAL = HexColor('#ef4444')
C_NOTE_MINT = HexColor('#10b981')
C_NOTE_BLUE = HexColor('#3b82f6')

NOTE_COLORS = {
    'coral': C_NOTE_CORAL,
    'mint': C_NOTE_MINT,
    'blue': C_NOTE_BLUE,
    'gold': C_GOLD,
    'purple': HexColor('#8b5cf6'),
    'rose': HexColor('#f43f5e'),
}


# ──── 注册中文字体 ────

def _register_fonts():
    """注册中文字体，优先外部TTF，否则使用CIDFont"""
    import os
    font_names = []
    
    # 1. macOS: PingFang (TTF轮廓的TTC)
    try:
        pdfmetrics.registerFont(TTFont('PingFang', '/System/Library/Fonts/PingFang.ttc', subfontIndex=0))
        pdfmetrics.registerFont(TTFont('PingFang-Bold', '/System/Library/Fonts/PingFang.ttc', subfontIndex=1))
        font_names.append('PingFang')
    except Exception:
        pass
    
    # 2. 查找本地 TTF 字体文件（项目自带或系统）
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    font_dir = os.path.join(base_dir, 'assets', 'fonts')
    ttf_candidates = [
        ('NotoSansSC', os.path.join(font_dir, 'NotoSansSC-Regular.ttf'),
                      os.path.join(font_dir, 'NotoSansSC-Bold.ttf')),
    ]
    for name, reg_path, bold_path in ttf_candidates:
        if os.path.exists(reg_path):
            try:
                pdfmetrics.registerFont(TTFont(name, reg_path))
                if os.path.exists(bold_path):
                    pdfmetrics.registerFont(TTFont(f'{name}-Bold', bold_path))
                else:
                    pdfmetrics.registerFont(TTFont(f'{name}-Bold', reg_path))  # fallback to regular
                font_names.append(name)
                break
            except Exception:
                continue
    
    # 3. CIDFont（reportlab内置CJK支持，无需外部字体文件）
    if not font_names:
        try:
            from reportlab.pdfbase.cidfonts import UnicodeCIDFont
            pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
            font_names.append('STSong-Light')
        except Exception:
            pass
    
    if 'PingFang' in font_names:
        return 'PingFang', 'PingFang-Bold'
    if font_names:
        name = font_names[0]
        # CIDFont 没有Bold变体，Normal和Bold用同一个
        if name == 'STSong-Light':
            return name, name
        return name, f'{name}-Bold'
    return 'Helvetica', 'Helvetica-Bold'


FONT_NORMAL, FONT_BOLD = _register_fonts()


# ──── 样式 ────

def _build_styles() -> Dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    styles: Dict[str, ParagraphStyle] = {}

    styles['title'] = ParagraphStyle(
        'CourseTitle', fontName=FONT_BOLD, fontSize=24, leading=32,
        textColor=C_FG, spaceAfter=4 * mm, alignment=TA_LEFT,
    )
    styles['subtitle'] = ParagraphStyle(
        'CourseSubtitle', fontName=FONT_NORMAL, fontSize=12, leading=18,
        textColor=C_MUTED, spaceAfter=6 * mm,
    )
    styles['section'] = ParagraphStyle(
        'Section', fontName=FONT_BOLD, fontSize=16, leading=22,
        textColor=C_PRIMARY, spaceBefore=8 * mm, spaceAfter=4 * mm,
    )
    styles['scene_title'] = ParagraphStyle(
        'SceneTitle', fontName=FONT_BOLD, fontSize=13, leading=18,
        textColor=C_FG, spaceBefore=4 * mm, spaceAfter=2 * mm,
    )
    styles['body'] = ParagraphStyle(
        'Body', fontName=FONT_NORMAL, fontSize=10, leading=16,
        textColor=C_FG, spaceAfter=2 * mm,
    )
    styles['body_muted'] = ParagraphStyle(
        'BodyMuted', fontName=FONT_NORMAL, fontSize=9, leading=14,
        textColor=C_MUTED, spaceAfter=1 * mm,
    )
    styles['key_point'] = ParagraphStyle(
        'KeyPoint', fontName=FONT_NORMAL, fontSize=10, leading=16,
        textColor=C_FG, leftIndent=8 * mm, spaceAfter=1 * mm,
        bulletFontName=FONT_NORMAL, bulletFontSize=10,
    )
    styles['note_title'] = ParagraphStyle(
        'NoteTitle', fontName=FONT_BOLD, fontSize=12, leading=17,
        textColor=C_FG, spaceBefore=3 * mm, spaceAfter=1 * mm,
    )
    styles['note_body'] = ParagraphStyle(
        'NoteBody', fontName=FONT_NORMAL, fontSize=10, leading=16,
        textColor=C_FG, leftIndent=4 * mm, spaceAfter=2 * mm,
    )
    styles['note_meta'] = ParagraphStyle(
        'NoteMeta', fontName=FONT_NORMAL, fontSize=8, leading=12,
        textColor=C_MUTED, spaceAfter=1 * mm,
    )
    styles['footer'] = ParagraphStyle(
        'Footer', fontName=FONT_NORMAL, fontSize=8, leading=10,
        textColor=C_MUTED, alignment=TA_CENTER,
    )
    styles['stat_value'] = ParagraphStyle(
        'StatValue', fontName=FONT_BOLD, fontSize=18, leading=22,
        textColor=C_PRIMARY, alignment=TA_CENTER,
    )
    styles['stat_label'] = ParagraphStyle(
        'StatLabel', fontName=FONT_NORMAL, fontSize=8, leading=12,
        textColor=C_MUTED, alignment=TA_CENTER,
    )
    styles['quiz_question'] = ParagraphStyle(
        'QuizQuestion', fontName=FONT_BOLD, fontSize=11, leading=16,
        textColor=C_FG, spaceBefore=2 * mm, spaceAfter=1 * mm,
    )
    styles['quiz_option'] = ParagraphStyle(
        'QuizOption', fontName=FONT_NORMAL, fontSize=10, leading=15,
        textColor=C_FG, leftIndent=8 * mm, spaceAfter=1 * mm,
    )
    return styles


# ──── 辅助 ────

def _safe(text: Any) -> str:
    """安全转字符串，处理None和特殊字符"""
    if text is None:
        return ''
    s = str(text)
    # ReportLab XML 转义
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return s


def _scene_type_label(t: str) -> str:
    return {'slide': '幻灯片', 'quiz': '测验', 'interactive': '互动', 'pbl': '项目'}.get(t, t)


def _extract_slide_texts(elements: list) -> list:
    """从 slide elements 提取文本内容，返回 [{'text': ..., 'is_title': bool}]"""
    import re
    texts = []
    for el in elements:
        if el.get('type') != 'text':
            continue
        raw = el.get('content', '')
        if not raw:
            continue
        # 去掉 HTML 标签
        clean = re.sub(r'<[^>]+>', '', raw).strip()
        if not clean:
            continue
        # 判断是否标题（font-size >= 24 或 font-weight: bold 且 font-size >= 18）
        is_title = False
        style_match = re.search(r'font-size:\s*(\d+)', raw)
        weight_match = re.search(r'font-weight:\s*(?:bold|[6-9]00)', raw)
        if style_match:
            fs = int(style_match.group(1))
            if fs >= 24 or (fs >= 18 and weight_match):
                is_title = True
        texts.append({'text': clean, 'is_title': is_title})
    return texts


def _estimate_minutes(scenes: list) -> int:
    m = 0
    for s in scenes:
        t = s.get('type', 'slide')
        m += {'slide': 5, 'interactive': 10, 'quiz': 8, 'pbl': 15}.get(t, 5)
    return m


# ──── 主生成函数 ────

async def generate_course_pdf(
    classroom: Dict[str, Any],
    notes: List[Dict[str, Any]],
) -> bytes:
    """
    生成课程 PDF，返回字节流。

    classroom: getClassroom API 返回的完整数据
    notes: 关联此课程的个人笔记列表（含 content 字段）
    """
    stage = classroom.get('stage', {})
    scenes = classroom.get('scenes', [])
    agents = classroom.get('agents', [])
    scenes_completed = classroom.get('scenes_completed', 0)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )
    styles = _build_styles()
    story: list = []

    # ════════ 封面区域 ════════

    story.append(Spacer(1, 12 * mm))

    # 课程标题
    story.append(Paragraph(_safe(stage.get('name', '未命名课程')), styles['title']))

    # 描述
    desc = stage.get('description', '')
    if desc:
        story.append(Paragraph(_safe(desc), styles['subtitle']))

    # 统计条
    total_scenes = len(scenes)
    est_min = _estimate_minutes(scenes)
    est_hours = round(est_min / 60, 1)
    instructor = _get_instructor(agents)

    stat_data = [
        [
            Paragraph(str(total_scenes), styles['stat_value']),
            Paragraph(f'~{est_hours}h', styles['stat_value']),
            Paragraph(_safe(instructor), styles['stat_value']),
            Paragraph(f'{scenes_completed}/{total_scenes}', styles['stat_value']),
        ],
        [
            Paragraph('场景', styles['stat_label']),
            Paragraph('预计时长', styles['stat_label']),
            Paragraph('讲师', styles['stat_label']),
            Paragraph('完成进度', styles['stat_label']),
        ],
    ]
    stat_table = Table(stat_data, colWidths=[40 * mm, 40 * mm, 40 * mm, 40 * mm])
    stat_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), C_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('TOPPADDING', (0, 0), (-1, 0), 4 * mm),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 3 * mm),
    ]))
    story.append(stat_table)

    # 标签
    tags = stage.get('tags', [])
    if tags:
        tag_text = '　'.join(f'#{_safe(t)}' for t in tags)
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(tag_text, ParagraphStyle(
            'Tags', fontName=FONT_NORMAL, fontSize=9, textColor=C_PRIMARY,
        )))

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4 * mm))

    # ════════ 课程目录 ════════

    story.append(Paragraph('课程目录', styles['section']))

    for i, scene in enumerate(scenes):
        title = scene.get('title', f'场景 {i + 1}')
        stype = scene.get('type', 'slide')
        oidx = scene.get('order_index', i)
        completed = i < scenes_completed

        # 场景标题行
        icon = '✓' if completed else '○'
        color = C_SECONDARY if completed else C_MUTED
        type_label = _scene_type_label(stype)

        header_style = ParagraphStyle(
            f'SceneHeader_{i}', parent=styles['scene_title'],
            textColor=color,
        )
        story.append(Paragraph(
            f'{icon}　{_safe(title)}　<font size="9" color="#{C_MUTED.hexval()[2:]}">{type_label} · 第{oidx + 1}节</font>',
            header_style,
        ))

        # 场景内容
        content = scene.get('content', {})
        if isinstance(content, dict):
            # ── Slide 类型：从 elements 提取文本 ──
            if stype == 'slide' and 'elements' in content:
                texts = _extract_slide_texts(content['elements'])
                for txt in texts:
                    if txt.get('is_title'):
                        story.append(Paragraph(
                            f'<b>{_safe(txt["text"])}</b>',
                            ParagraphStyle(f'SlideSub_{i}', fontName=FONT_BOLD, fontSize=11,
                                           leading=16, textColor=C_FG, spaceBefore=1 * mm, spaceAfter=1 * mm),
                        ))
                    else:
                        story.append(Paragraph(_safe(txt['text']), styles['body_muted']))

            # ── 旧格式兼容：description + key_points ──
            elif 'description' in content or 'key_points' in content:
                sdesc = content.get('description', '')
                if sdesc:
                    story.append(Paragraph(_safe(sdesc), styles['body_muted']))
                key_points = content.get('key_points', [])
                if key_points:
                    for kp in key_points:
                        story.append(Paragraph(f'• {_safe(kp)}', styles['key_point']))

            # ── Quiz 类型 ──
            if stype == 'quiz' or 'questions' in content:
                questions = content.get('questions', [])
                for qi, q in enumerate(questions):
                    qtext = q.get('question', q.get('text', ''))
                    if qtext:
                        story.append(Paragraph(
                            f'<font color="#{C_GOLD.hexval()[2:]}">Q{qi + 1}.</font> {_safe(qtext)}',
                            styles['quiz_question'],
                        ))
                    options = q.get('options', [])
                    for oi, opt in enumerate(options):
                        if isinstance(opt, dict):
                            label = opt.get('label', chr(65 + oi))
                            value = opt.get('value', '')
                            story.append(Paragraph(f'{label}. {_safe(value)}', styles['quiz_option']))
                        else:
                            letter = chr(65 + oi)
                            story.append(Paragraph(f'{letter}. {_safe(opt)}', styles['quiz_option']))
                    # 解析/答案
                    analysis = q.get('analysis', '')
                    if analysis:
                        story.append(Paragraph(
                            f'<font color="#{C_SECONDARY.hexval()[2:]}">解析：</font>{_safe(analysis)}',
                            styles['body_muted'],
                        ))

        story.append(Spacer(1, 2 * mm))

    # ════════ 笔记区域 ════════

    if notes:
        story.append(PageBreak())
        story.append(Paragraph('学习笔记', styles['section']))
        story.append(Paragraph(
            f'共 {len(notes)} 条笔记',
            ParagraphStyle('NoteCount', fontName=FONT_NORMAL, fontSize=9, textColor=C_MUTED, spaceAfter=4 * mm),
        ))

        for ni, note in enumerate(notes):
            note_color_name = note.get('color', 'coral')
            note_color = NOTE_COLORS.get(note_color_name, C_NOTE_CORAL)
            note_title = note.get('title', '无标题')
            note_content = note.get('content', '')
            note_category = note.get('category', '学习笔记')
            note_starred = note.get('starred', False)
            note_date = note.get('created_at', '')
            note_tags = note.get('tags', [])

            # 笔记卡片 - 彩色左边框
            card_items = []

            # 标题行
            star = ' ★' if note_starred else ''
            card_items.append(Paragraph(
                f'<font color="#{note_color.hexval()[2:]}">▎</font> {_safe(note_title)}{star}',
                styles['note_title'],
            ))

            # 元信息
            meta_parts = [_safe(note_category)]
            if note_date:
                meta_parts.append(_safe(note_date))
            if note_tags:
                meta_parts.append(' '.join(f'#{_safe(t)}' for t in note_tags if t))
            card_items.append(Paragraph('　·　'.join(meta_parts), styles['note_meta']))

            # 内容
            if note_content:
                # 按 \n 分段
                paragraphs = note_content.split('\n')
                for p in paragraphs:
                    p = p.strip()
                    if not p:
                        card_items.append(Spacer(1, 2 * mm))
                        continue
                    # Markdown 标题简化
                    if p.startswith('## '):
                        card_items.append(Paragraph(
                            f'<b>{_safe(p[3:])}</b>',
                            ParagraphStyle('NoteH2', fontName=FONT_BOLD, fontSize=11, leading=16,
                                           textColor=C_FG, spaceBefore=2 * mm, spaceAfter=1 * mm),
                        ))
                    elif p.startswith('# '):
                        card_items.append(Paragraph(
                            f'<b>{_safe(p[2:])}</b>',
                            ParagraphStyle('NoteH1', fontName=FONT_BOLD, fontSize=12, leading=18,
                                           textColor=C_PRIMARY, spaceBefore=3 * mm, spaceAfter=1 * mm),
                        ))
                    elif p.startswith('- '):
                        card_items.append(Paragraph(f'　• {_safe(p[2:])}', styles['note_body']))
                    else:
                        card_items.append(Paragraph(_safe(p), styles['note_body']))

            card_items.append(Spacer(1, 3 * mm))

            # 渲染卡片（带彩色左边框的表格）
            inner_table = Table([[card_items]], colWidths=[doc.width - 6 * mm])
            inner_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm),
                ('RIGHTPADDING', (0, 0), (-1, -1), 2 * mm),
                ('TOPPADDING', (0, 0), (-1, -1), 2 * mm),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2 * mm),
                ('BACKGROUND', (0, 0), (-1, -1), C_BG),
                ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ]))

            # 用两层表格实现左边框
            border_cell = Table(
                [[Paragraph('', ParagraphStyle('Border', fontSize=1)), inner_table]],
                colWidths=[2 * mm, doc.width - 6 * mm],
            )
            border_cell.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BACKGROUND', (0, 0), (0, -1), note_color),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))

            story.append(KeepTogether([border_cell, Spacer(1, 3 * mm)]))

    # ════════ 页脚 ════════

    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 3 * mm))
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    story.append(Paragraph(
        f'侧伴 CeBan · 为己而学，为人而行　|　导出时间：{now}',
        styles['footer'],
    ))

    # 构建 PDF
    doc.build(story)
    return buf.getvalue()


def _get_instructor(agents: list) -> str:
    if not agents:
        return 'AI 导师'
    teacher = next((a for a in agents if a.get('role') == 'teacher'), None)
    if teacher:
        return teacher.get('name', 'AI 导师')
    return agents[0].get('name', 'AI 导师')
