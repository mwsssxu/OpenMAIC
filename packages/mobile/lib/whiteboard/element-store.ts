import { useSyncExternalStore } from 'react';
import type { PPTElement } from '@/components/slide/types';

type Listener = () => void;

class WhiteboardElementStore {
  private elements: PPTElement[] = [];
  private listeners = new Set<Listener>();
  private idCounter = 0;

  getElements(): PPTElement[] {
    return this.elements;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  addElement(el: PPTElement): void {
    let withId = { ...el } as PPTElement;
    if (!withId.id) {
      (withId as any).id = `wb_${++this.idCounter}_${Date.now().toString(36)}`;
    }

    // 不再自动布局，因为 action-engine.ts 已经计算好了正确的位置
    // 自动布局会导致位置被重复调整

    this.elements = [...this.elements, withId];
    this.notify();
  }

  deleteElement(id: string): void {
    this.elements = this.elements.filter((el) => el.id !== id);
    this.notify();
  }

  updateElement(id: string, updates: Record<string, any>): void {
    const idx = this.elements.findIndex((el) => el.id === id);
    if (idx === -1) return;
    this.elements = this.elements.map((el, i) =>
      i === idx ? { ...el, ...updates } as PPTElement : el
    );
    this.notify();
  }

  clear(): void {
    this.elements = [];
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  useElements(): PPTElement[] {
    return useSyncExternalStore(
      (cb) => this.subscribe(cb),
      () => this.elements,
    );
  }
}

export const whiteboardStore = new WhiteboardElementStore();
