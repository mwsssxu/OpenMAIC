'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CollaborationClient } from '@/lib/websocket/collaboration-client';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'agent';
}

interface ChatPanelProps {
  client: CollaborationClient | null;
  agentId?: string;
}

export function ChatPanel({ client, agentId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client) return;

    client.on('chat', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.user_id,
          userName: data.user_name,
          content: data.content,
          timestamp: new Date(),
          type: 'user',
        },
      ]);
    });

    client.on('agent_response', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.agent_id,
          userName: data.agent_name,
          content: data.content,
          timestamp: new Date(),
          type: 'agent',
        },
      ]);
    });
  }, [client]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !client) return;

    client.sendChat(input.trim());
    setInput('');
  };

  const handleRequestAgent = () => {
    if (!input.trim() || !client || !agentId) return;

    client.requestAgent(input.trim(), agentId);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'agent' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[70%] px-3 py-2 rounded-lg ${
                msg.type === 'agent'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="text-xs font-medium mb-1">{msg.userName}</div>
              <div className="text-sm">{msg.content}</div>
              <div className="text-xs text-gray-500 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          发送
        </button>
        {agentId && (
          <button
            onClick={handleRequestAgent}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            问Agent
          </button>
        )}
      </div>
    </div>
  );
}