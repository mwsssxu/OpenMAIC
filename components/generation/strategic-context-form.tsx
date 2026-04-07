'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, Target, Users, AlertTriangle, Database, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { StrategicContext } from '@/lib/types/generation';

interface StrategicContextFormProps {
  value: StrategicContext;
  onChange: (value: StrategicContext) => void;
  language: 'zh-CN' | 'en-US';
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function StrategicContextForm({ value, onChange, language }: StrategicContextFormProps) {
  const isZh = language === 'zh-CN';
  
  const updateField = <K extends keyof StrategicContext>(field: K, fieldValue: StrategicContext[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };
  
  return (
    <div className="space-y-3">
      {/* 决策背景 */}
      <Section
        title={isZh ? '决策背景' : 'Decision Context'}
        icon={<Target className="w-4 h-4 text-blue-500" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <Label className="text-xs">
            {isZh ? '核心决策问题' : 'Decision Question'}
          </Label>
          <Textarea
            placeholder={isZh ? '需要做出什么决策？' : 'What decision needs to be made?'}
            value={value.decisionQuestion || ''}
            onChange={(e) => updateField('decisionQuestion', e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '决策时限' : 'Timeline'}</Label>
            <Input
              placeholder={isZh ? '如：Q2 2024' : 'e.g., Q2 2024'}
              value={value.timeline || ''}
              onChange={(e) => updateField('timeline', e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '紧迫程度' : 'Urgency'}</Label>
            <Select
              value={value.urgency || ''}
              onValueChange={(v) => updateField('urgency', v as StrategicContext['urgency'])}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={isZh ? '选择...' : 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{isZh ? '低' : 'Low'}</SelectItem>
                <SelectItem value="medium">{isZh ? '中' : 'Medium'}</SelectItem>
                <SelectItem value="high">{isZh ? '高' : 'High'}</SelectItem>
                <SelectItem value="critical">{isZh ? '紧急' : 'Critical'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>
      
      {/* 组织概况 */}
      <Section
        title={isZh ? '组织概况' : 'Organization Profile'}
        icon={<Building2 className="w-4 h-4 text-green-500" />}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '组织名称' : 'Organization'}</Label>
            <Input
              value={value.organizationName || ''}
              onChange={(e) => updateField('organizationName', e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '所属行业' : 'Industry'}</Label>
            <Input
              placeholder={isZh ? '如：金融科技' : 'e.g., Fintech'}
              value={value.industry || ''}
              onChange={(e) => updateField('industry', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '企业规模' : 'Company Size'}</Label>
            <Select
              value={value.companySize || ''}
              onValueChange={(v) => updateField('companySize', v as StrategicContext['companySize'])}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={isZh ? '选择...' : 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startup">{isZh ? '初创企业' : 'Startup'}</SelectItem>
                <SelectItem value="sme">{isZh ? '中小企业' : 'SME'}</SelectItem>
                <SelectItem value="enterprise">{isZh ? '大型企业' : 'Enterprise'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '营收规模' : 'Revenue Range'}</Label>
            <Input
              placeholder={isZh ? '如：1-10亿' : 'e.g., $10-100M'}
              value={value.revenueRange || ''}
              onChange={(e) => updateField('revenueRange', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{isZh ? '目标市场' : 'Target Markets'}</Label>
          <Input
            placeholder={isZh ? '如：中国, 东南亚 (逗号分隔)' : 'e.g., China, Southeast Asia'}
            value={value.markets?.join(', ') || ''}
            onChange={(e) => updateField('markets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="text-sm"
          />
        </div>
      </Section>
      
      {/* 利益相关者 */}
      <Section
        title={isZh ? '利益相关者' : 'Stakeholders'}
        icon={<Users className="w-4 h-4 text-purple-500" />}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '报告受众' : 'Target Audience'}</Label>
            <Input
              placeholder={isZh ? '如：董事会, 管理层 (逗号分隔)' : 'e.g., Board, Executive Team'}
              value={value.targetAudience?.join(', ') || ''}
              onChange={(e) => updateField('targetAudience', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '决策者' : 'Decision Makers'}</Label>
            <Input
              placeholder={isZh ? '如：CEO, CFO' : 'e.g., CEO, CFO'}
              value={value.decisionMakers?.join(', ') || ''}
              onChange={(e) => updateField('decisionMakers', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
        </div>
      </Section>
      
      {/* 约束与优先级 */}
      <Section
        title={isZh ? '约束与优先级' : 'Constraints & Priorities'}
        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '预算约束' : 'Budget Constraints'}</Label>
            <Input
              placeholder={isZh ? '如：预算上限500万' : 'e.g., Budget cap $5M'}
              value={value.budgetConstraints || ''}
              onChange={(e) => updateField('budgetConstraints', e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '资源约束' : 'Resource Constraints'}</Label>
            <Input
              placeholder={isZh ? '如：团队10人, 技术限制 (逗号分隔)' : 'e.g., Team of 10, Tech limitations'}
              value={value.resourceConstraints?.join(', ') || ''}
              onChange={(e) => updateField('resourceConstraints', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isZh ? '风险偏好' : 'Risk Tolerance'}</Label>
              <Select
                value={value.riskTolerance || ''}
                onValueChange={(v) => updateField('riskTolerance', v as StrategicContext['riskTolerance'])}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={isZh ? '选择...' : 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">{isZh ? '保守型' : 'Conservative'}</SelectItem>
                  <SelectItem value="moderate">{isZh ? '平衡型' : 'Moderate'}</SelectItem>
                  <SelectItem value="aggressive">{isZh ? '进取型' : 'Aggressive'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '核心优先级 (按重要性排序)' : 'Top Priorities (ranked)'}</Label>
            <Textarea
              placeholder={isZh ? '1. 第一优先级\n2. 第二优先级\n3. 第三优先级' : '1. First priority\n2. Second priority\n3. Third priority'}
              value={value.priorities?.join('\n') || ''}
              onChange={(e) => updateField('priorities', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              rows={3}
              className="text-sm"
            />
          </div>
        </div>
      </Section>
      
      {/* 数据与信息 */}
      <Section
        title={isZh ? '数据与信息' : 'Data & Information'}
        icon={<Database className="w-4 h-4 text-cyan-500" />}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '已有数据/资料' : 'Available Data'}</Label>
            <Input
              placeholder={isZh ? '如：财务报表, 行业报告 (逗号分隔)' : 'e.g., Financial reports, Industry data'}
              value={value.availableData?.join(', ') || ''}
              onChange={(e) => updateField('availableData', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '数据缺口' : 'Data Gaps'}</Label>
            <Input
              placeholder={isZh ? '缺少哪些关键数据？' : 'What key data is missing?'}
              value={value.dataGaps?.join(', ') || ''}
              onChange={(e) => updateField('dataGaps', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '竞争对手信息' : 'Competitor Info'}</Label>
            <Input
              placeholder={isZh ? '已知的竞争对手和情报' : 'Known competitors and intelligence'}
              value={value.competitorInfo?.join(', ') || ''}
              onChange={(e) => updateField('competitorInfo', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
        </div>
      </Section>
      
      {/* 背景与历史 */}
      <Section
        title={isZh ? '背景与历史' : 'Background & History'}
        icon={<History className="w-4 h-4 text-slate-500" />}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '过往决策/背景' : 'Previous Decisions'}</Label>
            <Textarea
              placeholder={isZh ? '相关的历史决策或背景信息' : 'Relevant historical decisions or context'}
              value={value.previousDecisions || ''}
              onChange={(e) => updateField('previousDecisions', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '当前挑战' : 'Current Challenges'}</Label>
            <Input
              placeholder={isZh ? '面临的主要挑战 (逗号分隔)' : 'Main challenges faced'}
              value={value.challenges?.join(', ') || ''}
              onChange={(e) => updateField('challenges', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isZh ? '成功标准' : 'Success Criteria'}</Label>
            <Input
              placeholder={isZh ? '如何衡量决策成功？' : 'How to measure success?'}
              value={value.successCriteria?.join(', ') || ''}
              onChange={(e) => updateField('successCriteria', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}