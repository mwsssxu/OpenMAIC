import { BookOpen, Sparkles, Heart } from 'lucide-react';
import { Locale, TranslationKeys } from '@/lib/i18n';

interface AboutSectionProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function AboutSection({ locale, t }: AboutSectionProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            <Heart className="w-4 h-4" />
            {locale === 'zh' ? '品牌故事' : 'Brand Story'}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t['about.title']}
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {t['about.subtitle']}
          </p>
        </div>

        {/* Story Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-16">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <BookOpen className="w-6 h-6" />
              {locale === 'zh' ? '古人伴读，今有侧伴' : 'From Ancient Companions to Modern AI'}
            </h3>
          </div>
          <div className="p-8 md:p-12">
            <div className="max-w-3xl mx-auto space-y-6 text-gray-600 leading-relaxed">
              <p className="text-lg">
                {t['about.story.p1']}
              </p>
              <p>
                {t['about.story.p2']}
              </p>
              <p>
                {t['about.story.p3']}
              </p>
              {/* Quote */}
              <blockquote className="border-l-4 border-blue-400 pl-6 py-4 bg-blue-50/60 rounded-r-xl italic text-gray-700">
                {t['about.story.quote']}
              </blockquote>
            </div>
          </div>
        </div>

        {/* Name Meaning */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
              <span className="text-4xl font-bold text-blue-600">侧</span>
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              {t['about.name.side.title']}
            </h4>
            <p className="text-gray-500">{t['about.name.side.desc']}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-2xl flex items-center justify-center">
              <span className="text-4xl font-bold text-indigo-600">伴</span>
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              {t['about.name.buddy.title']}
            </h4>
            <p className="text-gray-500">{t['about.name.buddy.desc']}</p>
          </div>
        </div>

        {/* Brand Values */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            { icon: '🤝', title: locale === 'zh' ? '温暖' : 'Warmth', desc: locale === 'zh' ? '像朋友在身边' : 'Like a friend by your side' },
            { icon: '🎯', title: locale === 'zh' ? '克制' : 'Restraint', desc: locale === 'zh' ? '尊重学习者自主性' : 'Respects learner autonomy' },
            { icon: '📚', title: locale === 'zh' ? '专业' : 'Professional', desc: locale === 'zh' ? '随时提供帮助' : 'Always ready to help' },
            { icon: '💎', title: locale === 'zh' ? '持久' : 'Enduring', desc: locale === 'zh' ? '长期陪伴不离弃' : 'Long-term companionship' },
          ].map((value, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{value.icon}</div>
              <h5 className="font-semibold text-gray-900 mb-1">{value.title}</h5>
              <p className="text-sm text-gray-500">{value.desc}</p>
            </div>
          ))}
        </div>

        {/* Academic Background */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200 p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {locale === 'zh' ? '学术根基' : 'Academic Foundation'}
              </h4>
              <p className="text-gray-600 leading-relaxed mb-3">
                {locale === 'zh'
                  ? '侧伴基于清华大学 MAIC 实验室开源项目 OpenMAIC 构建，发表于 JCST\'26 学术期刊。'
                  : 'Built on OpenMAIC, an open-source project from Tsinghua University\'s MAIC Lab, published in JCST\'26.'}
              </p>
              <p className="text-sm text-gray-400">
                {locale === 'zh' ? '论文：Open Multi-Agent Interactive Classroom' : 'Paper: Open Multi-Agent Interactive Classroom'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
