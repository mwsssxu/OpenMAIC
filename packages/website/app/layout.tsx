import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '侧伴 | CeBan - AI学习伙伴',
  description: '侧伴，默默守护你的学习。AI多智能体互动课堂，让学习不再孤单。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  );
}