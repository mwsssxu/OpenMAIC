'use client';

import React, { useState, useEffect } from 'react';
import { CollaborationClient } from '@/lib/websocket/collaboration-client';

interface Participant {
  userId: string;
  userName: string;
  role: 'host' | 'participant';
  joinedAt: Date;
  isOnline: boolean;
}

interface ParticipantsListProps {
  client: CollaborationClient | null;
}

export function ParticipantsList({ client }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!client) return;

    // 定义handler函数以便后续清理
    const handleUserJoined = (data: any) => {
      setParticipants((prev) => [
        ...prev.filter((p) => p.userId !== data.user_id),
        {
          userId: data.user_id,
          userName: data.user_name,
          role: data.role || 'participant',
          joinedAt: new Date(),
          isOnline: true,
        },
      ]);
    };

    const handleUserLeft = (data: any) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.user_id ? { ...p, isOnline: false } : p
        )
      );
    };

    // 注册handler
    client.on('user_joined', handleUserJoined);
    client.on('user_left', handleUserLeft);

    // 清理函数 - 组件卸载或client变化时移除handler
    return () => {
      client.off('user_joined', handleUserJoined);
      client.off('user_left', handleUserLeft);
    };
  }, [client]);

  const onlineCount = participants.filter((p) => p.isOnline).length;

  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm font-medium mb-3">
        在线参与者 ({onlineCount})
      </div>
      <div className="space-y-2">
        {participants
          .filter((p) => p.isOnline)
          .sort((a, b) => {
            if (a.role === 'host') return -1;
            if (b.role === 'host') return 1;
            return a.joinedAt.getTime() - b.joinedAt.getTime();
          })
          .map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 py-1"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  p.role === 'host' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              />
              <div className="text-sm">
                {p.userName}
                {p.role === 'host' && (
                  <span className="text-xs text-yellow-600 ml-1">(主持人)</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}