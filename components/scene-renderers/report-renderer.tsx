'use client';

import type { ReportContent, StageMode } from '@/lib/types/stage';

interface ReportRendererProps {
  readonly content: ReportContent;
  readonly mode: StageMode;
  readonly sceneId: string;
}

export function ReportRenderer({ content, mode }: ReportRendererProps) {
  const reportTypeLabels: Record<string, string> = {
    market: '市场分析报告',
    competitive: '竞争分析报告',
    financial: '财务分析报告',
    strategic: '战略分析报告',
  };

  return (
    <div className="w-full h-full overflow-auto bg-white p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {reportTypeLabels[content.reportType] || '商业分析报告'}
          </h1>
        </header>
        
        <div className="space-y-6">
          {content.sections.map((section) => (
            <section key={section.id} className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{section.title}</h2>
              <div className="text-gray-600 whitespace-pre-wrap">{section.content}</div>
              
              {section.charts && section.charts.length > 0 && (
                <div className="mt-4 space-y-4">
                  {section.charts.map((chart) => (
                    <div key={chart.id} className="bg-white rounded border p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">{chart.title}</h3>
                      <div className="text-xs text-gray-500">图表类型: {chart.chartType}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}