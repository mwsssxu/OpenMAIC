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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:underline">
            OpenMAIC Business
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/classrooms/create')}
          >
            创建课程
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">我的课程</h1>
          <Button onClick={() => router.push('/classrooms/create')}>
            新建课程
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">加载中...</div>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="bg-white rounded-card shadow p-12 text-center">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-500 mb-4">还没有创建任何课程</p>
            <Button onClick={() => router.push('/classrooms/create')}>
              创建第一个课程
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((classroom) => (
              <div
                key={classroom.id}
                className="bg-white rounded-card shadow hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <h2 className="font-semibold text-lg mb-2">{classroom.name}</h2>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {classroom.description || '暂无描述'}
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    创建于 {new Date(classroom.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/classrooms/${classroom.id}`)}
                    >
                      播放
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(classroom.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}