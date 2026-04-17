import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export interface WhiteboardElement {
  id: string;
  type: 'path' | 'shape' | 'text' | 'eraser';
  userId: string;
  timestamp: number;
  data: {
    color?: string;
    width?: number;
    points?: Array<{ x: number; y: number }>;
    content?: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  };
}

export class WhiteboardSync {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private elements: Y.Array<WhiteboardElement>;
  private token: string;
  private observers: Array<() => void> = [];

  constructor(roomId: string, token: string) {
    this.doc = new Y.Doc();
    this.elements = this.doc.getArray<WhiteboardElement>('whiteboard');
    this.token = token;

    // Token不再通过URL params传递
    const wsUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000'}/sessions/${roomId}/yjs`;
    const wsProtocol = wsUrl.replace('http', 'ws');

    this.provider = new WebsocketProvider(
      wsProtocol,
      roomId,
      this.doc
    );

    // 连接成功后发送认证
    if (this.provider.ws) {
      this.provider.ws.onopen = () => {
        this.provider?.ws?.send(JSON.stringify({ type: 'auth', token: this.token }));
      };
    }
  }

  /**
   * 观察元素变化，返回清理函数
   */
  observe(callback: (elements: WhiteboardElement[]) => void): () => void {
    const observer = () => {
      callback(this.elements.toArray());
    };
    this.elements.observe(observer);
    this.observers.push(observer);

    // 返回清理函数
    return () => {
      this.elements.unobserve(observer);
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  addElement(element: WhiteboardElement): void {
    this.elements.push([element]);
  }

  updateElement(id: string, data: Partial<WhiteboardElement['data']>): void {
    const elementsArr = this.elements.toArray();
    const index = elementsArr.findIndex(e => e.id === id);
    if (index !== -1) {
      const current = this.elements.get(index);
      this.elements.delete(index, 1);
      this.elements.insert(index, [{
        ...current,
        data: { ...current.data, ...data },
      }]);
    }
  }

  removeElement(id: string): void {
    const index = this.elements.toArray().findIndex(e => e.id === id);
    if (index !== -1) {
      this.elements.delete(index, 1);
    }
  }

  clear(): void {
    this.elements.delete(0, this.elements.length);
  }

  getElements(): WhiteboardElement[] {
    return this.elements.toArray();
  }

  disconnect(): void {
    // 清理所有observer
    this.observers.forEach(observer => {
      this.elements.unobserve(observer);
    });
    this.observers = [];

    this.provider?.disconnect();
    this.provider?.destroy();
    this.doc.destroy();
  }

  isConnected(): boolean {
    return this.provider?.wsconnected ?? false;
  }
}