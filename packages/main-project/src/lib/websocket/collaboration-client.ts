/**
 * WebSocket客户端 - 连接多人课堂协作服务
 */

type MessageType = 'join' | 'leave' | 'chat' | 'whiteboard_action' | 'scene_change' | 'user_joined' | 'user_left' | 'reaction' | 'agent_response' | 'request_agent' | 'session_end' | 'ping';

interface WebSocketMessage {
  type: MessageType;
  data: any;
}

interface CollaborationOptions {
  roomId: string;
  token: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private messageHandlers: Map<MessageType, ((data: any) => void)[]> = new Map();

  constructor(private options: CollaborationOptions) {
    this.roomId = options.roomId;
    this.token = options.token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000'}/sessions/${this.roomId}/ws?token=${this.token}`;
      const wsProtocol = wsUrl.replace('http', 'ws');

      this.ws = new WebSocket(wsProtocol);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('WebSocket connected to room:', this.roomId);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
          this.options.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.options.onError?.(new Error('WebSocket connection error'));
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('WebSocket closed');
        this.options.onClose?.();

        // 尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log('Attempting reconnect...', this.reconnectAttempts);
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.data));
    }
  }

  on(type: MessageType, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  off(type: MessageType, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 发送聊天消息
  sendChat(content: string): void {
    this.send({
      type: 'chat',
      data: { content },
    });
  }

  // 发送白板操作
  sendWhiteboardAction(action: string, data: any): void {
    this.send({
      type: 'whiteboard_action',
      data: { action, ...data },
    });
  }

  // 发送场景切换（仅主持人）
  sendSceneChange(sceneIndex: number): void {
    this.send({
      type: 'scene_change',
      data: { scene_index: sceneIndex },
    });
  }

  // 发送表情反应
  sendReaction(reaction: string): void {
    this.send({
      type: 'reaction',
      data: { reaction },
    });
  }

  // 请求Agent回答
  requestAgent(question: string, agentId: string): void {
    this.send({
      type: 'request_agent',
      data: { question, agent_id: agentId },
    });
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  // 心跳检测
  startHeartbeat(interval: number = 30000): void {
    const heartbeat = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', data: {} });
      } else {
        clearInterval(heartbeat);
      }
    }, interval);
  }
}

// 创建协作客户端的hook
export function useCollaboration(roomId: string, token: string) {
  const [client, setClient] = React.useState<CollaborationClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (roomId && token) {
      const collaborationClient = new CollaborationClient({
        roomId,
        token,
        onClose: () => setIsConnected(false),
      });

      collaborationClient.connect().then(() => {
        setIsConnected(true);
        setClient(collaborationClient);
      });

      return () => {
        collaborationClient.disconnect();
      };
    }
  }, [roomId, token]);

  return { client, isConnected };
}

import React from 'react';