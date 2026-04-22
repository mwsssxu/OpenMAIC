import { Locale, TranslationKeys } from '@/lib/i18n';

interface ArchitectureSectionProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function ArchitectureSection({ locale, t }: ArchitectureSectionProps) {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
          {t['architecture.title']}
        </h2>
        <p className="text-center text-gray-500 mb-16 max-w-2xl mx-auto">
          {t['architecture.subtitle']}
        </p>

        {/* Architecture Overview */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Web */}
          <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl border border-blue-100 p-8 text-center">
            <div className="text-5xl mb-4">🌐</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {locale === 'zh' ? '官网 & Web 应用' : 'Website & Web App'}
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              {locale === 'zh'
                ? '产品展示、用户注册、课程生成入口'
                : 'Product showcase, user registration, course generation'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS'].map(tech => (
                <span key={tech} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Backend */}
          <div className="bg-gradient-to-b from-purple-50 to-white rounded-2xl border border-purple-100 p-8 text-center">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {locale === 'zh' ? '后端服务' : 'Backend Services'}
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              {locale === 'zh'
                ? '多智能体调度、课程生成、用户管理'
                : 'Multi-agent orchestration, course generation, user management'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              <div className="px-2 py-1 bg-purple-50 rounded">
                <span className="text-purple-700 font-medium">API 端点</span>
                <span className="text-purple-900 font-bold ml-1">231</span>
              </div>
              <div className="px-2 py-1 bg-purple-50 rounded">
                <span className="text-purple-700 font-medium">数据库表</span>
                <span className="text-purple-900 font-bold ml-1">62</span>
              </div>
              <div className="px-2 py-1 bg-purple-50 rounded">
                <span className="text-purple-700 font-medium">前端页面</span>
                <span className="text-purple-900 font-bold ml-1">67</span>
              </div>
              <div className="px-2 py-1 bg-purple-50 rounded">
                <span className="text-purple-700 font-medium">ORM 模型</span>
                <span className="text-purple-900 font-bold ml-1">80+</span>
              </div>
            </div>
          </div>

          {/* Mobile */}
          <div className="bg-gradient-to-b from-green-50 to-white rounded-2xl border border-green-100 p-8 text-center">
            <div className="text-5xl mb-4">📱</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {locale === 'zh' ? '移动端 App' : 'Mobile App'}
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              {locale === 'zh'
                ? '课程播放、学习打卡、问答互动'
                : 'Course playback, study check-in, Q&A interaction'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Expo', 'React Native', 'TypeScript', 'Skia'].map(tech => (
                <span key={tech} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Key Tech Highlights */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200 p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            {locale === 'zh' ? '技术亮点' : 'Tech Highlights'}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                emoji: '🤖',
                title: locale === 'zh' ? '多智能体协作' : 'Multi-Agent Collaboration',
                desc: locale === 'zh'
                  ? 'LangGraph 编排 AI 教师、助教、同学角色协同教学'
                  : 'LangGraph orchestrates AI teachers, assistants, and students'
              },
              {
                emoji: '🎤',
                title: locale === 'zh' ? '语音讲解 (TTS)' : 'Voice Narration (TTS)',
                desc: locale === 'zh'
                  ? '支持多 TTS 服务商，AI 角色语音讲解课堂内容'
                  : 'Multi-provider TTS, AI voices explain course content'
              },
              {
                emoji: '🎨',
                title: locale === 'zh' ? '白板绘图' : 'Whiteboard Drawing',
                desc: locale === 'zh'
                  ? '实时绘制图表、书写公式、可视化教学'
                  : 'Real-time diagrams, formulas, visual teaching'
              },
              {
                emoji: '📊',
                title: locale === 'zh' ? '学习评估' : 'Learning Assessment',
                desc: locale === 'zh'
                  ? '精通/熟练/掌握/了解/需复习，五级能力评估'
                  : '5-level mastery: 精通/熟练/掌握/了解/需复习'
              },
              {
                emoji: '🔗',
                title: locale === 'zh' ? 'OpenClaw 集成' : 'OpenClaw Integration',
                desc: locale === 'zh'
                  ? '通过飞书、Slack、Telegram 等 20+ 聊天应用直接生成课堂'
                  : 'Generate courses from Feishu, Slack, Telegram, and 20+ chat apps'
              },
              {
                emoji: '📹',
                title: locale === 'zh' ? '视频转课程' : 'Video-to-Course',
                desc: locale === 'zh'
                  ? '支持 YouTube/Bilibili 视频自动解析生成课程'
                  : 'Auto-parse YouTube/Bilibili videos into courses'
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">{item.emoji}</div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
