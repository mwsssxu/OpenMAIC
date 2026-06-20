## Whiteboard Reference

### Canvas Specifications

**Dimensions**: 1000 × ∞ (width fixed at 1000, height unlimited — supports vertical scrolling).

**Coordinate system**: `x = 0` at the left edge, `x = 1000` at the right edge. `y = 0` at the top. Height is unlimited — elements can be placed at any y coordinate. Users can scroll vertically to view content below the initial viewport. Every element has `(left, top)` at its top-left corner.

**Safe zone**: keep content within `x ∈ [20, 980]` and `y ∈ [20, 543]` to leave a 20px margin from the canvas edges.

**Reference points**:
- Centered horizontally: `x = (1000 - width) / 2`
- Centered vertically: `y = (563 - height) / 2` (initial viewport only — content can extend below)
- Two-column layout: left column `x ∈ [20, 480]`, right column `x ∈ [520, 980]` (40px gutter)

### JSON Output Context

Whiteboard actions are `{"type":"action","name":"wb_...", "params":{...}}` items inside the JSON array your response is required to be. All positions are integers (or decimals accepted, but stay in pixel units).

**LaTeX fields deserve special care — see the "LaTeX JSON Escape" section below.**

### Action Reference

For every whiteboard action, the JSON shape below is the **complete, canonical** form. All other prose in this file assumes these shapes.

#### wb_open

Open the whiteboard before drawing. Once open, `wb_draw_*` calls auto-render.

```json
{"type":"action","name":"wb_open","params":{}}
```

No parameters. Call before any `wb_draw_*`. Not required before every `wb_draw_*` — only once at the start of a drawing phase.

#### wb_draw_text

Place plain text. Use for notes, steps, labels — **not** for math formulas (use `wb_draw_latex` instead).

```json
{"type":"action","name":"wb_draw_text","params":{"content":"Step 1: identify forces","x":60,"y":60,"width":600,"height":43,"fontSize":18,"color":"#333333"}}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | yes | Plain text or HTML `<p>` block. No LaTeX commands. |
| `x` | number | yes | Left edge in pixels. |
| `y` | number | yes | Top edge in pixels. |
| `width` | number | no (default 400) | Text container width. |
| `height` | number | no (default 100) | Text container height. Use the Font Size Table below to pick a matching height. |
| `fontSize` | number | no (default 18) | Point size. Pick from the Font Size Table. |
| `color` | string | no (default `#333333`) | Hex color. |
| `elementId` | string | no | Stable ID for later `wb_delete`. |

**Common mistake**: embedding LaTeX like `"content":"\\frac{a}{b}"` in a text element — KaTeX is NOT run on text content, so the raw backslash prints. Use `wb_draw_latex` for any math.

#### wb_draw_shape

Place a geometric shape. Use for annotations, groupings, or simple diagrams.

```json
{"type":"action","name":"wb_draw_shape","params":{"shape":"rectangle","x":60,"y":200,"width":200,"height":100,"fillColor":"#5b9bd5","label":"概念名","textColor":"#ffffff"}}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `shape` | `"rectangle"` \| `"rounded_rectangle"` \| `"circle"` \| `"triangle"` \| `"diamond"` \| `"hexagon"` | yes | Primitive shape. |
| `x`, `y` | number | yes | Top-left of the shape's bounding box. |
| `width`, `height` | number | yes | Bounding box size. **Minimum 300×100** for readability on mobile (shapes smaller than 300×100 render as tiny boxes with unreadable text). |
| `fillColor` | string | no (default `#5b9bd5`) | Hex fill color. |
| `label` | string | no | Text label rendered inside the shape. |
| `textColor` | string | no (default `#ffffff`) | Label text color. |
| `outline` | object | no | `{width, color, style}` for border. |
| `opacity` | number | no (default 1) | 0–1 transparency. |
| `elementId` | string | no | Stable ID. |

#### wb_draw_line

Draw a straight line or arrow.

```json
{"type":"action","name":"wb_draw_line","params":{"startX":100,"startY":300,"endX":400,"endY":300,"color":"#333333","width":2,"points":["","arrow"]}}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `startX`, `startY` | number | yes | Start coordinates. |
| `endX`, `endY` | number | yes | End coordinates. |
| `color` | string | no (default `#333333`) | Hex color. |
| `width` | number | no (default 2) | **Stroke thickness**, NOT line length. Keep 2–4. |
| `style` | `"solid"` \| `"dashed"` | no (default `"solid"`) | Line style. |
| `points` | `[start, end]` of `""` or `"arrow"` | no (default `["",""]`) | Arrow markers at each end. |
| `elementId` | string | no | Stable ID. |

#### wb_draw_latex

Render a math formula via KaTeX.

```json
{"type":"action","name":"wb_draw_latex","params":{"latex":"\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}","x":100,"y":80,"height":80}}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `latex` | string | yes | LaTeX source. **Every `\` must be written as `\\` in the JSON string — see "LaTeX JSON Escape" below.** |
| `x`, `y` | number | yes | Top-left. |
| `height` | number | no (default 80) | Preferred rendered height. |
| `width` | number | no (default 400) | Max horizontal space. Auto-computed from height × aspect ratio unless this cap kicks in. |
| `color` | string | no (default `#000000`) | Hex color. |
| `elementId` | string | no | Stable ID. |

**Most common mistake**: single-backslash commands. If your rendered board shows literal words like `ext`, `heta`, `imes`, `rac`, `ightarrow`, that is the bug. Next response: rewrite with `\\text`, `\\theta`, etc.

#### wb_draw_chart

Render a data chart.

```json
{"type":"action","name":"wb_draw_chart","params":{"chartType":"bar","x":100,"y":150,"width":500,"height":300,"data":{"labels":["Q1","Q2","Q3"],"legends":["Sales"],"series":[[100,120,140]]}}}
```

#### wb_draw_table

Render a simple table.

```json
{"type":"action","name":"wb_draw_table","params":{"x":100,"y":200,"width":500,"height":150,"data":[["Variable","Meaning"],["a","Coefficient of x²"],["b","Coefficient of x"],["c","Constant term"]]}}
```

#### wb_draw_code

Draw a code block with syntax highlighting.

```json
{"type":"action","name":"wb_draw_code","params":{"language":"python","code":"def greet(name):\n    print(f'Hello, {name}')","x":100,"y":120,"width":500,"height":120,"fileName":"hello.py","elementId":"code1"}}
```

#### wb_delete

Remove one element by ID.

```json
{"type":"action","name":"wb_delete","params":{"elementId":"step1"}}
```

#### wb_clear

Remove **all** elements from the whiteboard.

```json
{"type":"action","name":"wb_clear","params":{}}
```

#### wb_close

Close the whiteboard to reveal the slide canvas.

```json
{"type":"action","name":"wb_close","params":{}}
```

### LaTeX JSON Escape (CRITICAL)

**The rule**: in any JSON string containing LaTeX — **every backslash must be written as `\\` (two characters)** in your JSON output.

Characters at risk:
- `\t` → `\text`, `\theta`, `\times`, `\tau`
- `\r` → `\rightarrow`, `\rho`
- `\f` → `\frac`, `\forall`, `\phi`
- `\b` → `\beta`, `\bar`
- `\v` → `\varphi`, `\vec`

**Correctness table**:

| LaTeX source | ❌ Wrong in JSON | ✅ Right in JSON |
|---|---|---|
| `\frac{a}{b}` | `"\frac{a}{b}"` | `"\\frac{a}{b}"` |
| `\text{合规}` | `"\text{合规}"` | `"\\text{合规}"` |
| `\theta` | `"\theta"` | `"\\theta"` |
| `\rightarrow` | `"\rightarrow"` | `"\\rightarrow"` |

### Bounds & Overlap

**Hard bounds** (every element):
- `x ≥ 0` and `x + width ≤ 1000`
- `y ≥ 0` (no upper bound — content can extend below 563, users can scroll)

**Safe zone**: `20 ≤ x`, `x + width ≤ 980`, `20 ≤ y`, `y + height ≤ 542`.

**Spacing**:
- Minimum gap between adjacent elements: 20px
- Vertical stacking: `next.y = prev.y + prev.height + 30`

### Font Size Table

| Content type | `fontSize` |
|---|---|
| Whiteboard title | 28-32 |
| Section heading | 20-24 |
| Body / annotation | 16-18 |
| Caption / fine print | 12-14 |

### Pre-Output Checklist

Before emitting whiteboard actions:

1. **[LaTeX escape]** Every `\` in `latex` params is written as `\\` in JSON.
2. **[Hard bounds]** For each element: `x ≥ 0`, `y ≥ 0`, `x + width ≤ 1000`. No upper bound on `y` — content can extend below the initial viewport and users can scroll vertically.
3. **[Overlap]** Walk existing elements; new bbox overlaps none by more than 30%.
4. **[Font consistency]** Every `fontSize` comes from the Font Size Table.