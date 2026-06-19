import { useSyncExternalStore } from 'react';
import type { PPTElement } from '@/components/slide/types';

type Listener = () => void;

export interface WhiteboardPage {
  id: string;
  elements: PPTElement[];
  createdAt: number;
}

class WhiteboardElementStore {
  /** 当前页的元素 */
  private elements: PPTElement[] = [];
  /** 已归档的历史页 */
  private pages: WhiteboardPage[] = [];
  private listeners = new Set<Listener>();
  private idCounter = 0;
  private pageCounter = 0;

  getElements(): PPTElement[] {
    return this.elements;
  }

  getPages(): WhiteboardPage[] {
    return this.pages;
  }

  isEmpty(): boolean {
    return this.elements.length === 0 && this.pages.length === 0;
  }

  addElement(el: PPTElement): void {
    let withId = { ...el } as PPTElement;
    if (!withId.id) {
      (withId as any).id = `wb_${++this.idCounter}_${Date.now().toString(36)}`;
    }

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

  /** 将当前元素归档为一个新页，然后清空当前元素列表 */
  archiveCurrentPage(): void {
    if (this.elements.length === 0) return;
    const page: WhiteboardPage = {
      id: `page_${++this.pageCounter}_${Date.now().toString(36)}`,
      elements: this.elements,
      createdAt: Date.now(),
    };
    this.pages = [...this.pages, page];
    this.elements = [];
    this.notify();
  }

  /** 用户手动清空——清空当前页和所有历史页 */
  clearAll(): void {
    this.elements = [];
    this.pages = [];
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

  usePages(): WhiteboardPage[] {
    return useSyncExternalStore(
      (cb) => this.subscribe(cb),
      () => this.pages,
    );
  }
}

export const whiteboardStore = new WhiteboardElementStore();
