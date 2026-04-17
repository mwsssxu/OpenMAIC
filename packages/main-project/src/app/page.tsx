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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">加载中...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - 渐变背景 */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
              🎯
            </div>
            <h1 className="text-xl font-bold">OpenMAIC Business</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-full px-4 py-2 text-sm">
              {user?.nickname || user?.email}
            </div>
            <Button
              className="bg-white/20 hover:bg-white/30 text-white border-none"
              onClick={() => router.push('/classrooms')}
            >
              📚 我的课程
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="hero-section mb-8 animate-fade-in">
          <div className="hero-title">🎯 商业策略研究平台</div>
          <div className="hero-subtitle">AI驱动的交互式学习体验，让商业知识触手可及</div>
          <Button
            className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-bold hover:bg-white/90 shadow-lg"
            onClick={() => router.push('/classrooms/create')}
          >
            ✨ 开始创建课程
          </Button>
        </section>

        {/* Quick Actions - 活泼卡片 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">⚡</span> 快速开始
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 animate-slide-in cursor-pointer group" onClick={() => router.push('/classrooms/create')}>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                ✍️
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">创建课程</h3>
              <p className="text-gray-500 text-sm mb-4">输入主题或上传文档，AI自动生成交互式课程</p>
              <button className="btn-accent text-sm px-4 py-2">立即创建</button>
            </div>

            <div className="card p-6 animate-slide-in cursor-pointer group" style={{ animationDelay: '0.1s' }} onClick={() => router.push('/classrooms')}>
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                📚
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">我的课程</h3>
              <p className="text-gray-500 text-sm mb-4">查看和管理已创建的课程</p>
              <button className="btn-secondary text-sm px-4 py-2">查看课程</button>
            </div>

            <div className="card p-6 animate-slide-in cursor-pointer group" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                💬
              </div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">AI讨论</h3>
              <p className="text-gray-500 text-sm mb-4">与多智能体进行商业策略讨论</p>
              <button className="btn-primary text-sm px-4 py-2">开始讨论</button>
            </div>
          </div>
        </section>

        {/* Stats - 活泼统计卡片 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> 学习统计
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-6 text-center animate-bounce-in">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
                📖
              </div>
              <div className="text-3xl font-bold text-indigo-600">0</div>
              <div className="text-sm text-gray-500 mt-1">课程数量</div>
            </div>

            <div className="card p-6 text-center animate-bounce-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
                ⏱️
              </div>
              <div className="text-3xl font-bold text-cyan-600">0h</div>
              <div className="text-sm text-gray-500 mt-1">学习时长</div>
            </div>

            <div className="card p-6 text-center animate-bounce-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
                ⭐
              </div>
              <div className="text-3xl font-bold text-orange-500">500</div>
              <div className="text-sm text-gray-500 mt-1">积分余额</div>
            </div>

            <div className="card p-6 text-center animate-bounce-in" style={{ animationDelay: '0.3s' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
                💎
              </div>
              <div className="text-3xl font-bold text-pink-500">200</div>
              <div className="text-sm text-gray-500 mt-1">Token余额</div>
            </div>
          </div>
        </section>

        {/* Tips Section */}
        <section className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">💡</span> 使用技巧
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="badge badge-primary">TIP</div>
              <p className="text-gray-600 text-sm">输入"SWOT分析"等主题，AI会自动生成包含互动Quiz的课程</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-success">NEW</div>
              <p className="text-gray-600 text-sm">完成课程学习可获得积分，积分可兑换Token解锁更多内容</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-warning">HOT</div>
              <p className="text-gray-600 text-sm">多人课堂支持实时白板协作，邀请好友一起学习效果更佳</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-primary">AI</div>
              <p className="text-gray-600 text-sm">多智能体讨论功能支持商业策略深度分析</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}