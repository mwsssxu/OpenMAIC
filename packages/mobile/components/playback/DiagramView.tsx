/**
 * DiagramView - 可交互信息图组件
 *
 * 支持 mermaid 语法渲染流程图、思维导图、序列图等
 * LLM 只输出 mermaid 语法的图定义，不再生成完整 HTML
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { 
  View, StyleSheet, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Dimensions, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const PRIMARY_COLOR = '#ec5b13';

// Diagram 数据结构（LLM 输出）
export interface DiagramData {
  type: 'diagram';
  /** mermaid 语法的图定义 */
  mermaid: string;
  /** 图表标题 */
  title?: string;
  /** 图表类型：flowchart/mindmap/sequence/class/state */
  chartType?: string;
  /** 描述文字 */
  description?: string;
  /** 知识要点 */
  keyPoints?: string[];
}

// Simulation 数据结构（LLM 输出）
export interface SimulationData {
  type: 'simulation';
  title?: string;
  description?: string;
  /** 可调参数 */
  parameters: SimulationParam[];
  /** 公式列表 */
  formulas?: string[];
  /** 初始结果 */
  initialResult?: string;
  /** 计算逻辑描述 */
  calculationLogic?: string;
}

export interface SimulationParam {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

interface DiagramViewProps {
  data: DiagramData;
  onComplete?: () => void;
}

// Mermaid 渲染用的 HTML 模板（固定，不含任何 LLM 生成的代码）
const MERMAID_HTML_TEMPLATE = (mermaidCode: string) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #ffffff; 
      display: flex; 
      justify-content: center; 
      align-items: flex-start;
      min-height: 100vh;
      padding: 16px;
      -webkit-overflow-scrolling: touch;
    }
    .mermaid { 
      max-width: 100%; 
      overflow: auto;
    }
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <pre class="mermaid">
${mermaidCode}
  </pre>
  <script>
    mermaid.initialize({ 
      startOnLoad: true, 
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      mindmap: { useMaxWidth: true },
      sequence: { useMaxWidth: true, actorMargin: 50 },
    });
    setTimeout(function() {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'loaded'}));
    }, 500);
  </script>
</body>
</html>
`;

export const DiagramView = memo(function DiagramView({ data, onComplete }: DiagramViewProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent?.data || '{}');
      if (msg.type === 'loaded') {
        setLoadState('loaded');
      }
    } catch {}
  }, []);

  const handleError = useCallback(() => {
    setLoadState('error');
  }, []);

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));

  const html = MERMAID_HTML_TEMPLATE(data.mermaid);

  return (
    <View style={styles.container}>
      {data.title ? (
        <View style={styles.titleBar}>
          <Ionicons name="git-branch" size={20} color={PRIMARY_COLOR} />
          <Text style={styles.title}>{data.title}</Text>
          {data.chartType && (
            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={styles.chartTypeText}>{data.chartType}</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.zoomControls}>
        <TouchableOpacity onPress={zoomOut} style={styles.zoomBtn}>
          <Ionicons name="remove" size={18} color="#666" />
        </TouchableOpacity>
        <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
        <TouchableOpacity onPress={zoomIn} style={styles.zoomBtn}>
          <Ionicons name="add" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={[styles.webviewWrapper, { transform: [{ scale: zoomLevel }] }]}>
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          onMessage={handleMessage}
          onError={handleError}
          style={styles.webview}
          scrollEnabled={true}
          bounces={false}
        />
        {loadState === 'loading' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}
        {loadState === 'error' && (
          <View style={styles.errorOverlay}>
            <Ionicons name="image-outline" size={48} color="#ccc" />
            <Text style={styles.errorText}>图表渲染失败</Text>
            <Text style={styles.errorHint}>请尝试重新加载</Text>
          </View>
        )}
      </View>

      {(data.description || (data.keyPoints && data.keyPoints.length > 0)) && (
        <ScrollView style={styles.infoSection} showsVerticalScrollIndicator={false}>
          {data.description ? (
            <Text style={styles.description}>{data.description}</Text>
          ) : null}
          {data.keyPoints && data.keyPoints.length > 0 ? (
            <View style={styles.keyPointsList}>
              {data.keyPoints.map((point, idx) => (
                <View key={idx} style={styles.keyPointItem}>
                  <View style={styles.keyPointDot} />
                  <Text style={styles.keyPointText}>{point}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      {onComplete && (
        <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
          <Text style={styles.completeBtnText}>已了解</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ========== Simulation 模板组件 ==========

interface SimulationViewProps {
  data: SimulationData;
  onComplete?: () => void;
}

export const SimulationView = memo(function SimulationView({ data, onComplete }: SimulationViewProps) {
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const vals: Record<string, number> = {};
    data.parameters.forEach(p => { vals[p.id] = p.default; });
    return vals;
  });
  const [result] = useState<string>(data.initialResult || '');

  const updateParam = (id: string, value: number) => {
    setParamValues(prev => ({ ...prev, [id]: value }));
  };

  const resetParams = () => {
    const vals: Record<string, number> = {};
    data.parameters.forEach(p => { vals[p.id] = p.default; });
    setParamValues(vals);
  };

  return (
    <View style={styles.container}>
      {data.title ? (
        <View style={styles.titleBar}>
          <Ionicons name="options" size={20} color={PRIMARY_COLOR} />
          <Text style={styles.title}>{data.title}</Text>
          <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={styles.chartTypeText}>simulation</Text>
          </View>
        </View>
      ) : null}

      <ScrollView style={styles.paramsSection} showsVerticalScrollIndicator={false}>
        {data.parameters.map(param => (
          <View key={param.id} style={styles.paramItem}>
            <View style={styles.paramHeader}>
              <Text style={styles.paramName}>{param.name}</Text>
              <Text style={styles.paramValue}>
                {paramValues[param.id]?.toFixed(param.step < 1 ? 1 : 0)}
                {param.unit ? ` ${param.unit}` : ''}
              </Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{param.min}</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity 
                  style={styles.stepperBtn}
                  onPress={() => updateParam(param.id, Math.max(param.min, (paramValues[param.id] || param.default) - param.step))}
                >
                  <Ionicons name="remove" size={16} color="#666" />
                </TouchableOpacity>
                <View style={styles.stepperValue}>
                  <Text style={styles.stepperValueText}>
                    {paramValues[param.id]?.toFixed(param.step < 1 ? 1 : 0)}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.stepperBtn}
                  onPress={() => updateParam(param.id, Math.min(param.max, (paramValues[param.id] || param.default) + param.step))}
                >
                  <Ionicons name="add" size={16} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sliderLabel}>{param.max}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {data.formulas && data.formulas.length > 0 && (
        <View style={styles.formulasSection}>
          <Text style={styles.formulasTitle}>公式</Text>
          {data.formulas.map((f, idx) => (
            <Text key={idx} style={styles.formulaText}>{f}</Text>
          ))}
        </View>
      )}

      {result ? (
        <View style={styles.resultSection}>
          <Text style={styles.resultLabel}>计算结果</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}

      {data.description ? (
        <Text style={styles.description}>{data.description}</Text>
      ) : null}

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.resetBtn} onPress={resetParams}>
          <Ionicons name="refresh" size={16} color="#666" />
          <Text style={styles.resetBtnText}>重置</Text>
        </TouchableOpacity>
        {onComplete && (
          <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
            <Text style={styles.completeBtnText}>已了解</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  chartTypeText: {
    fontSize: 11,
    color: '#2e7d32',
    fontWeight: '500',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 12,
    color: '#666',
    minWidth: 36,
    textAlign: 'center',
  },
  webviewWrapper: {
    height: 300,
    marginHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  } as any,
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  errorHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#bbb',
  },
  infoSection: {
    maxHeight: 150,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  keyPointsList: {
    gap: 6,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  keyPointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
    marginTop: 7,
  },
  keyPointText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
    lineHeight: 18,
  },
  completeBtn: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  paramsSection: {
    maxHeight: 300,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  paramItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paramName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  paramValue: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
    minWidth: 30,
  },
  stepperRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperValue: {
    minWidth: 50,
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  formulasSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    borderRadius: 8,
  },
  formulasTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  formulaText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'monospace' as any,
    paddingVertical: 2,
  },
  resultSection: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginTop: 8,
  },
  resultLabel: {
    fontSize: 12,
    color: '#2e7d32',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1b5e20',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  resetBtnText: {
    fontSize: 14,
    color: '#666',
  },
});
