import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Classroom {
  id: string;
  name: string;
  description?: string;
  language_directive?: string;
  created_at: string;
  updated_at: string;
}

export function useClassrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getClassrooms();
      setClassrooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  return { classrooms, loading, error, refresh };
}