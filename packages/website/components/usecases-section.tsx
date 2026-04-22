import { Locale, TranslationKeys } from '@/lib/i18n';

interface UseCasesSectionProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function UseCasesSection({ locale, t }: UseCasesSectionProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
          {t['usecases.title']}
        </h2>
        <p className="text-center text-gray-500 mb-16 max-w-2xl mx-auto">
          {t['usecases.subtitle']}
        </p>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Case 1: Students */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                🎓 {locale === 'zh' ? '学生 & 自学者' : 'Students & Self-Learners'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {locale === 'zh'
                  ? '输入任何学习主题，AI 自动生成包含幻灯片、测验和互动模拟的完整课程。AI 教师和同学陪你学习，不再孤单。'
                  : 'Enter any topic, AI auto-generates a complete course with slides, quizzes, and interactive simulations. AI teachers and classmates learn with you.'}
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '一键生成个性化课程' : 'One-click personalized courses'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '学习搭子陪伴打卡' : 'Study buddy check-in reminders'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '游戏化成长体系' : 'Gamified growth system'}
                </li>
              </ul>
            </div>
          </div>

          {/* Case 2: Teachers */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                👩‍🏫 {locale === 'zh' ? '教师 & 培训讲师' : 'Teachers & Trainers'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {locale === 'zh'
                  ? '快速创建教学课件，支持导出 PPTX 格式。AI 助教自动答疑，释放教师精力专注于教学设计。'
                  : 'Quickly create teaching materials, export to PPTX. AI assistants handle Q&A, freeing teachers to focus on instructional design.'}
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '分钟级课件生成' : 'Minute-level courseware generation'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '导出可编辑 PPTX' : 'Export editable PPTX'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? 'AI 助教自动答疑' : 'AI teaching assistant Q&A'}
                </li>
              </ul>
            </div>
          </div>

          {/* Case 3: Enterprise */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                🏢 {locale === 'zh' ? '企业 & 团队' : 'Enterprise & Teams'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {locale === 'zh'
                  ? '企业管理员可创建团队、分配必修课程、跟踪学习进度。支持学习报表和排行榜，量化培训效果。'
                  : 'Admins create teams, assign mandatory courses, track progress. Learning reports and leaderboards quantify training effectiveness.'}
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '团队管理与角色分配' : 'Team management & roles'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '学习报表与统计' : 'Learning reports & analytics'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '企业专属课程' : 'Enterprise-specific courses'}
                </li>
              </ul>
            </div>
          </div>

          {/* Case 4: Content Creators */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                ✍️ {locale === 'zh' ? '知识创作者' : 'Content Creators'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {locale === 'zh'
                  ? '发布优质笔记赚取收益，共享笔记 70/30 分成。视频自动转课程，让内容创作效率倍增。'
                  : 'Publish premium notes for revenue, 70/30 split. Video auto-conversion to courses multiplies content creation efficiency.'}
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '共享笔记知识变现' : 'Shared notes monetization'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '视频转课程自动化' : 'Automated video-to-course'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {locale === 'zh' ? '问答悬赏赚取积分' : 'Q&A bounty earnings'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
