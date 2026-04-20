import { Locale, TranslationKeys } from '@/lib/i18n';
import { Heart, Users, BookOpen, MessageCircle, Trophy, Gift } from 'lucide-react';

interface FeaturesProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

const features = [
  { key: 'buddy', icon: Heart, color: '#ec4899' },
  { key: 'agents', icon: Users, color: '#5b9bd5' },
  { key: 'notes', icon: BookOpen, color: '#10b981' },
  { key: 'quiz', icon: MessageCircle, color: '#f59e0b' },
  { key: 'growth', icon: Trophy, color: '#ef4444' },
  { key: 'reward', icon: Gift, color: '#06b6d4' },
];

export default function Features({ locale, t }: FeaturesProps) {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Title */}
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          {t['features.title']}
        </h2>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map(({ key, icon: Icon, color }) => (
            <div key={key} className="card group">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t[`features.${key}.title` as TranslationKeys]}
              </h3>
              <p className="text-gray-600">
                {t[`features.${key}.desc` as TranslationKeys]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}