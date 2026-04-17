'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface Classroom {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export default function ClassroomsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadClassrooms();
    }
  }, [isAuthenticated]);

  async function loadClassrooms() {
    try {
      const data = await apiClient.getClassrooms();
      setClassrooms(data);
    } catch (error) {
      console.error('Load classrooms error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个课程吗？')) return;

    try {
      await apiClient.deleteClassroom(id);
      setClassrooms(classrooms.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-xl">
              🎯
            </div>
            <span className="text-xl font-bold">OpenMAIC</span>
          </Link>
          <Button
            className="bg-white/20 hover:bg-white/30 text-white border-none"
            onClick={() => router.push('/classrooms/create')}
          >
            ✨ 创建课程
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📚</span> 我的课程
            </h1>
            <p className="text-gray-500 mt-1">管理和学习您的课程内容</p>
          </div>
          <Button
            className="btn-primary flex items-center gap-2"
            onClick={() => router.push('/classrooms/create')}
          >
            <span>✍️</span> 新建课程
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="loading-spinner mx-auto mb-4"></div>
              <div className="text-gray-500">加载课程...</div>
            </div>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="card p-12 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg">
              📖
            </div>
            <p className="text-gray-500 mb-2 font-medium">还没有创建任何课程</p>
            <p className="text-gray-400 text-sm mb-6">AI将帮助您快速生成专业的交互式课程</p>
            <Button
              className="btn-accent"
              onClick={() => router.push('/classrooms/create')}
            >
              🚀 创建第一个课程
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom, index) => (
              <div
                key={classroom.id}
                className="card p-6 animate-slide-in group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* 卡片顶部装饰 */}
                <div className="h-3 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-t-xl mb-4 -mx-6 -mt-6"></div>

                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📊
                  </div>
                  <div className="badge badge-primary">课程</div>
                </div>

                <h2 className="font-bold text-lg mb-2 text-gray-800 group-hover:text-indigo-600 transition-colors">
                  {classroom.name}
                </h2>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                  {classroom.description || '暂无描述'}
                </p>
                <div className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <span>📅</span> 创建于 {new Date(classroom.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-3">
                  <Button
                    size="sm"
                    className="btn-primary flex-1"
                    onClick={() => router.push(`/classrooms/${classroom.id}`)}
                  >
                    🎬 播放
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    onClick={() => handleDelete(classroom.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 统计卡片 */}
        <div className="mt-8 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">{classrooms.length}</div>
              <div className="text-sm text-gray-500">课程总数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-500">学习时长</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600">0</div>
              <div className="text-sm text-gray-500">互动次数</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}