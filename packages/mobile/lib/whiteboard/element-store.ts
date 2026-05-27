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

  addElement(el: PPTElement): void {
    if (!el.id) {
      (el as any).id = `wb_${++this.idCounter}_${Date.now().toString(36)}`;
    }
    this.elements = [...this.elements, el];
    this.notify();
  }

  deleteElement(id: string): void {
    this.elements = this.elements.filter((el) => el.id !== id);
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
