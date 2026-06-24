/**
 * 交互组件库 — 预构件模板系统
 *
 * 设计原则：
 * 1. 每个组件是自包含 HTML，通过 JSON 参数注入
 * 2. 支持原生 postMessage 通信（widget_setState/HIGHLIGHT）
 * 3. 移动端适配（viewport meta + touch events + 响应式布局）
 * 4. 组件代码人工开发、人工测试，LLM 只生成参数 JSON
 *
 * 扩展方式：
 * - 新增组件：在 WIDGET_TEMPLATES 中注册 + 编写 render 函数
 * - 不需要改 LLM prompt 架构，只需在 prompt 中列出可用组件
 */

// ====== 组件参数类型 ======
export interface WidgetParam {
  name: string;
  label: string;
  min?: number;
  max?: number;
  default: number | string;
  unit?: string;
  step?: number;
}

export interface WidgetSchema {
  /** 组件类型标识 */
  type: string;
  /** 人类可读名称 */
  name: string;
  /** 组件描述（供 LLM 选择参考） */
  description: string;
  /** 适用知识点标签 */
  tags: string[];
  /** 可调参数定义 */
  params: WidgetParam[];
  /** 预设场景 */
  presets: { name: string; params: Record<string, number | string> }[];
}

// ====== 组件注册表 ======
export const WIDGET_SCHEMAS: WidgetSchema[] = [
  {
    type: 'function-plotter',
    name: '函数图像绘制器',
    description: '绘制数学函数图像，支持滑块调节参数，实时查看曲线变化',
    tags: ['数学', '函数', '图像', '二次函数', '三角函数', '指数', '对数'],
    params: [
      { name: 'a', label: '系数 a', min: -5, max: 5, default: 1, step: 0.1 },
      { name: 'b', label: '系数 b', min: -5, max: 5, default: 0, step: 0.1 },
      { name: 'c', label: '系数 c', min: -5, max: 5, default: 0, step: 0.1 },
      { name: 'xRange', label: 'X 范围', min: 5, max: 30, default: 10, step: 1 },
    ],
    presets: [
      { name: '二次函数 y=ax²+bx+c', params: { a: 1, b: 0, c: 0, xRange: 10 } },
      { name: '正弦波 y=a·sin(bx+c)', params: { a: 2, b: 1, c: 0, xRange: 10 } },
    ],
  },
  {
    type: 'projectile-motion',
    name: '抛体运动模拟',
    description: '模拟抛体运动，可调节角度、初速度、重力，实时查看轨迹',
    tags: ['物理', '力学', '抛体', '运动', '重力', '角度'],
    params: [
      { name: 'angle', label: '发射角度', min: 0, max: 90, default: 45, unit: '°', step: 1 },
      { name: 'velocity', label: '初速度', min: 5, max: 50, default: 20, unit: 'm/s', step: 1 },
      { name: 'gravity', label: '重力加速度', min: 1, max: 20, default: 9.8, unit: 'm/s²', step: 0.1 },
    ],
    presets: [
      { name: '45度最大射程', params: { angle: 45, velocity: 20, gravity: 9.8 } },
      { name: '高重力环境', params: { angle: 60, velocity: 30, gravity: 15 } },
    ],
  },
];

// ====== HTML 生成器 ======

/**
 * 生成函数图像绘制器的完整 HTML
 */
function renderFunctionPlotter(params: Record<string, number | string>): string {
  const a = Number(params.a ?? 1);
  const b = Number(params.b ?? 0);
  const c = Number(params.c ?? 0);
  const xRange = Number(params.xRange ?? 10);

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 12px; -webkit-user-select: none; user-select: none; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h2 { font-size: 16px; color: #818cf8; }
  .formula { font-size: 14px; color: #cbd5e1; margin-top: 4px; font-family: monospace; }
  .canvas-wrap { position: relative; width: 100%; aspect-ratio: 1.4; background: #1e293b; border-radius: 12px; overflow: hidden; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  .controls { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .ctrl-row { display: flex; align-items: center; gap: 8px; }
  .ctrl-label { font-size: 12px; color: #94a3b8; min-width: 60px; }
  .ctrl-value { font-size: 12px; color: #818cf8; min-width: 40px; text-align: right; font-family: monospace; }
  input[type=range] { flex: 1; height: 28px; background: transparent; -webkit-appearance: none; appearance: none; }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; background: #334155; border-radius: 2px; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #818cf8; margin-top: -8px; cursor: pointer; }
  input[type=range]::-moz-range-track { height: 4px; background: #334155; border-radius: 2px; }
  input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #818cf8; border: none; cursor: pointer; }
  .presets { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .preset-btn { padding: 4px 10px; font-size: 11px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; cursor: pointer; }
  .preset-btn:active { background: #334155; }
</style>
</head>
<body>
  <div class="header">
    <h2>函数图像绘制器</h2>
    <div class="formula" id="formula">y = ${a}x² + ${b}x + ${c}</div>
  </div>
  <div class="canvas-wrap">
    <canvas id="canvas"></canvas>
  </div>
  <div class="controls">
    <div class="ctrl-row"><span class="ctrl-label">系数 a</span><input type="range" id="a" min="-5" max="5" step="0.1" value="${a}"><span class="ctrl-value" id="a-val">${a}</span></div>
    <div class="ctrl-row"><span class="ctrl-label">系数 b</span><input type="range" id="b" min="-5" max="5" step="0.1" value="${b}"><span class="ctrl-value" id="b-val">${b}</span></div>
    <div class="ctrl-row"><span class="ctrl-label">系数 c</span><input type="range" id="c" min="-5" max="5" step="0.1" value="${c}"><span class="ctrl-value" id="c-val">${c}</span></div>
    <div class="presets">
      <button class="preset-btn" onclick="setPreset(1,0,0)">y=x²</button>
      <button class="preset-btn" onclick="setPreset(-1,0,0)">y=-x²</button>
      <button class="preset-btn" onclick="setPreset(0,0,3)">y=3 (常数)</button>
    </div>
  </div>
<script>
(function(){
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var params = { a: ${a}, b: ${b}, c: ${c}, xRange: ${xRange} };

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resize);

  function draw() {
    var w = canvas.getBoundingClientRect().width;
    var h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    // 坐标系
    var xMin = -params.xRange, xMax = params.xRange;
    var yMin = -params.xRange, yMax = params.xRange;
    var toX = function(x) { return (x - xMin) / (xMax - xMin) * w; };
    var toY = function(y) { return h - (y - yMin) / (yMax - yMin) * h; };

    // 网格
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (var i = xMin; i <= xMax; i += 2) {
      ctx.beginPath(); ctx.moveTo(toX(i), 0); ctx.lineTo(toX(i), h); ctx.stroke();
    }
    for (var j = yMin; j <= yMax; j += 2) {
      ctx.beginPath(); ctx.moveTo(0, toY(j)); ctx.lineTo(w, toY(j)); ctx.stroke();
    }

    // 坐标轴
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(w, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), h); ctx.stroke();

    // 函数曲线
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    var first = true;
    for (var px = 0; px < w; px++) {
      var x = xMin + (px / w) * (xMax - xMin);
      var y = params.a * x * x + params.b * x + params.c;
      var py = toY(y);
      if (py >= -100 && py <= h + 100) {
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      } else {
        first = true;
      }
    }
    ctx.stroke();

    // 标签
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('x', w - 12, toY(0) - 6);
    ctx.fillText('y', toX(0) + 6, 12);
  }

  function updateParam(name, val) {
    params[name] = parseFloat(val);
    document.getElementById(name + '-val').textContent = parseFloat(val).toFixed(1);
    var a = params.a, b = params.b, c = params.c;
    var formula = 'y = ';
    if (a !== 0) formula += a.toFixed(1) + 'x² ';
    if (b !== 0) formula += (b > 0 ? '+ ' : '- ') + Math.abs(b).toFixed(1) + 'x ';
    if (c !== 0) formula += (c > 0 ? '+ ' : '- ') + Math.abs(c).toFixed(1);
    if (formula === 'y = ') formula = 'y = 0';
    document.getElementById('formula').textContent = formula;
    draw();
    notifyState();
  }

  ['a','b','c'].forEach(function(name) {
    var el = document.getElementById(name);
    el.addEventListener('input', function(e) { updateParam(name, e.target.value); });
  });

  window.setPreset = function(a, b, c) {
    document.getElementById('a').value = a;
    document.getElementById('b').value = b;
    document.getElementById('c').value = c;
    updateParam('a', a); updateParam('b', b); updateParam('c', c);
  };

  // postMessage 通信 — 接收教师 widget_setState
  window.addEventListener('message', function(event) {
    var msg = event.data || {};
    if (msg.type === 'SET_WIDGET_STATE' && msg.state) {
      Object.keys(msg.state).forEach(function(key) {
        var el = document.getElementById(key);
        if (el) { el.value = msg.state[key]; updateParam(key, msg.state[key]); }
      });
    }
    if (msg.type === 'HIGHLIGHT_ELEMENT' && msg.target) {
      var el = document.querySelector(msg.target);
      if (el) {
        el.style.outline = '3px solid #fbbf24';
        el.style.outlineOffset = '2px';
        setTimeout(function() { el.style.outline = ''; }, 2000);
      }
    }
  });

  // 向原生发送状态
  function notifyState() {
    var data = { type: 'state', payload: params };
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } else if (window.parent) {
      window.parent.postMessage(data, '*');
    }
  }

  resize();
})();
</script>
</body>
</html>`;
}

/**
 * 生成抛体运动模拟器的完整 HTML
 */
function renderProjectileMotion(params: Record<string, number | string>): string {
  const angle = Number(params.angle ?? 45);
  const velocity = Number(params.velocity ?? 20);
  const gravity = Number(params.gravity ?? 9.8);

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 12px; -webkit-user-select: none; user-select: none; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h2 { font-size: 16px; color: #34d399; }
  .info { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .canvas-wrap { position: relative; width: 100%; aspect-ratio: 1.6; background: #1e293b; border-radius: 12px; overflow: hidden; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  .controls { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .ctrl-row { display: flex; align-items: center; gap: 8px; }
  .ctrl-label { font-size: 12px; color: #94a3b8; min-width: 70px; }
  .ctrl-value { font-size: 12px; color: #34d399; min-width: 50px; text-align: right; font-family: monospace; }
  input[type=range] { flex: 1; height: 28px; -webkit-appearance: none; appearance: none; background: transparent; }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; background: #334155; border-radius: 2px; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #34d399; margin-top: -8px; cursor: pointer; }
  input[type=range]::-moz-range-track { height: 4px; background: #334155; border-radius: 2px; }
  input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #34d399; border: none; cursor: pointer; }
  .btn-row { display: flex; gap: 8px; margin-top: 6px; }
  .btn { flex: 1; padding: 8px; font-size: 13px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
  .btn-launch { background: #34d399; color: #0f172a; }
  .btn-clear { background: #334155; color: #e2e8f0; }
  .stats { display: flex; gap: 12px; margin-top: 8px; font-size: 12px; }
  .stat { color: #64748b; }
  .stat span { color: #34d399; font-family: monospace; }
</style>
</head>
<body>
  <div class="header">
    <h2>抛体运动模拟</h2>
    <div class="info" id="info">角度 ${angle}° · 初速度 ${velocity} m/s · 重力 ${gravity} m/s²</div>
  </div>
  <div class="canvas-wrap"><canvas id="canvas"></canvas></div>
  <div class="controls">
    <div class="ctrl-row"><span class="ctrl-label">发射角度</span><input type="range" id="angle" min="0" max="90" step="1" value="${angle}"><span class="ctrl-value" id="angle-val">${angle}°</span></div>
    <div class="ctrl-row"><span class="ctrl-label">初速度</span><input type="range" id="velocity" min="5" max="50" step="1" value="${velocity}"><span class="ctrl-value" id="velocity-val">${velocity}</span></div>
    <div class="ctrl-row"><span class="ctrl-label">重力 g</span><input type="range" id="gravity" min="1" max="20" step="0.1" value="${gravity}"><span class="ctrl-value" id="gravity-val">${gravity}</span></div>
    <div class="btn-row">
      <button class="btn btn-launch" id="launch">🚀 发射</button>
      <button class="btn btn-clear" id="clear">清除轨迹</button>
    </div>
    <div class="stats">
      <div class="stat">射程: <span id="range-stat">-</span> m</div>
      <div class="stat">最高点: <span id="height-stat">-</span> m</div>
      <div class="stat">飞行时间: <span id="time-stat">-</span> s</div>
    </div>
  </div>
<script>
(function(){
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var params = { angle: ${angle}, velocity: ${velocity}, gravity: ${gravity} };
  var trails = [];
  var ball = null;
  var animId = null;

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resize);

  function getScale() {
    var v = params.velocity, g = params.gravity;
    var range = v * v * Math.sin(2 * params.angle * Math.PI / 180) / g;
    var maxH = v * v * Math.sin(params.angle * Math.PI / 180) ** 2 / (2 * g);
    var maxX = Math.max(range * 1.2, 20);
    var maxY = Math.max(maxH * 1.5, 15);
    return { maxX: maxX, maxY: maxY };
  }

  function draw() {
    var w = canvas.getBoundingClientRect().width;
    var h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);
    var s = getScale();
    var toX = function(x) { return 30 + (x / s.maxX) * (w - 40); };
    var toY = function(y) { return h - 30 - (y / s.maxY) * (h - 40); };

    // 地面
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, h - 30); ctx.lineTo(w, h - 30); ctx.stroke();

    // 网格刻度
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    for (var i = 0; i <= s.maxX; i += Math.ceil(s.maxX / 8)) {
      ctx.fillText(i + 'm', toX(i) - 8, h - 14);
    }

    // 轨迹
    trails.forEach(function(trail) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      trail.forEach(function(p, i) { i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y)); });
      ctx.stroke();
    });

    // 当前轨迹
    if (ball && ball.trail.length > 1) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ball.trail.forEach(function(p, i) { i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y)); });
      ctx.stroke();
    }

    // 球
    if (ball) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(toX(ball.x), toY(ball.y), 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 发射器
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(30, h - 30, 5, 0, Math.PI * 2);
    ctx.fill();
    // 角度指示
    var rad = params.angle * Math.PI / 180;
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, h - 30);
    ctx.lineTo(30 + Math.cos(rad) * 25, h - 30 - Math.sin(rad) * 25);
    ctx.stroke();
  }

  function launch() {
    if (animId) cancelAnimationFrame(animId);
    var v = params.velocity, g = params.gravity;
    var rad = params.angle * Math.PI / 180;
    var vx = v * Math.cos(rad), vy = v * Math.sin(rad);
    var t = 0, dt = 0.02;
    ball = { x: 0, y: 0, trail: [{ x: 0, y: 0 }] };

    // 计算预测值
    var range = v * v * Math.sin(2 * rad) / g;
    var maxH = (v * Math.sin(rad)) ** 2 / (2 * g);
    var flightTime = 2 * vy / g;
    document.getElementById('range-stat').textContent = range.toFixed(1);
    document.getElementById('height-stat').textContent = maxH.toFixed(1);
    document.getElementById('time-stat').textContent = flightTime.toFixed(1);

    function step() {
      t += dt;
      ball.x = vx * t;
      ball.y = vy * t - 0.5 * g * t * t;
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.y < 0) { ball.y = 0; draw(); ball = null; animId = null; return; }
      draw();
      animId = requestAnimationFrame(step);
    }
    step();
  }

  function updateParam(name, val) {
    params[name] = parseFloat(val);
    var suffix = name === 'angle' ? '°' : '';
    document.getElementById(name + '-val').textContent = parseFloat(val).toFixed(name === 'gravity' ? 1 : 0) + suffix;
    document.getElementById('info').textContent = '角度 ' + params.angle + '° · 初速度 ' + params.velocity + ' m/s · 重力 ' + params.gravity + ' m/s²';
    draw();
    notifyState();
  }

  ['angle','velocity','gravity'].forEach(function(name) {
    document.getElementById(name).addEventListener('input', function(e) { updateParam(name, e.target.value); });
  });

  document.getElementById('launch').addEventListener('click', launch);
  document.getElementById('clear').addEventListener('click', function() {
    trails = []; if (ball) { if (ball.trail.length > 0) trails.push(ball.trail); ball = null; } draw();
  });

  // postMessage 通信
  window.addEventListener('message', function(event) {
    var msg = event.data || {};
    if (msg.type === 'SET_WIDGET_STATE' && msg.state) {
      Object.keys(msg.state).forEach(function(key) {
        var el = document.getElementById(key);
        if (el) { el.value = msg.state[key]; updateParam(key, msg.state[key]); }
      });
    }
  });

  function notifyState() {
    var data = { type: 'state', payload: params };
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
    else if (window.parent) window.parent.postMessage(data, '*');
  }

  resize();
})();
</script>
</body>
</html>`;
}

// ====== 组件渲染入口 ======

const RENDERERS: Record<string, (params: Record<string, number | string>) => string> = {
  'function-plotter': renderFunctionPlotter,
  'projectile-motion': renderProjectileMotion,
};

/**
 * 根据 widget 类型和参数生成完整 HTML
 */
export function renderWidget(
  widgetType: string,
  params: Record<string, number | string>
): string {
  const renderer = RENDERERS[widgetType];
  if (!renderer) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#94a3b8;background:#0f172a">
      <p>未知组件类型: ${widgetType}</p>
      <p>可用组件: ${Object.keys(RENDERERS).join(', ')}</p>
    </body></html>`;
  }
  return renderer(params);
}

/**
 * 获取所有可用组件的 schema 描述（供 LLM prompt 使用）
 */
export function getWidgetCatalogForPrompt(): string {
  return WIDGET_SCHEMAS.map(function(s) {
    var paramsStr = s.params.map(function(p) {
      return p.name + '(' + p.min + '~' + p.max + ', default:' + p.default + (p.unit || '') + ')';
    }).join(', ');
    return '- type: "' + s.type + '" | ' + s.name + ' | tags: [' + s.tags.join('/') + '] | params: ' + paramsStr;
  }).join('\n');
}

/**
 * 获取组件默认参数
 */
export function getDefaultParams(widgetType: string): Record<string, number | string> {
  var schema = WIDGET_SCHEMAS.find(function(s) { return s.type === widgetType; });
  if (!schema) return {};
  var defaults: Record<string, number | string> = {};
  schema.params.forEach(function(p) { defaults[p.name] = p.default; });
  return defaults;
}
