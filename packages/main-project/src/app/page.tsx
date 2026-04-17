'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">OpenMAIC Business</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user?.nickname || user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/classrooms')}
            >
              我的课程
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">快速开始</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-card p-6 shadow hover:shadow-md transition-shadow">
              <div className="text-accent-gold text-3xl mb-2">📝</div>
              <h3 className="font-semibold mb-2">创建课程</h3>
              <p className="text-gray-500 text-sm mb-4">输入主题或上传文档，AI自动生成交互式课程</p>
              <Button onClick={() => router.push('/classrooms/create')}>
                开始创建
              </Button>
            </div>
            <div className="bg-white rounded-card p-6 shadow hover:shadow-md transition-shadow">
              <div className="text-success text-3xl mb-2">📚</div>
              <h3 className="font-semibold mb-2">我的课程</h3>
              <p className="text-gray-500 text-sm mb-4">查看和管理已创建的课程</p>
              <Button variant="outline" onClick={() => router.push('/classrooms')}>
                查看课程
              </Button>
            </div>
            <div className="bg-white rounded-card p-6 shadow hover:shadow-md transition-shadow">
              <div className="text-primary text-3xl mb-2">💬</div>
              <h3 className="font-semibold mb-2">AI讨论</h3>
              <p className="text-gray-500 text-sm mb-4">与多智能体进行商业策略讨论</p>
              <Button variant="secondary">
                开始讨论
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">学习统计</h2>
          <div className="bg-white rounded-card p-6 shadow">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-sm text-gray-500">课程数量</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">0</div>
                <div className="text-sm text-gray-500">学习时长</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent-gold">0</div>
                <div className="text-sm text-gray-500">积分余额</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-400">0</div>
                <div className="text-sm text-gray-500">Token余额</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}