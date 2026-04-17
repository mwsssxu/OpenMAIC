import { create } from 'zustand';

interface Scene {
  id: string;
  type: string;
  title: string;
  order_index: number;
  content: any;
  actions: any[];
}

interface PlaybackState {
  scenes: Scene[];
  currentSceneIndex: number;
  isPlaying: boolean;
  showWhiteboard: boolean;
  whiteboardElements: any[];
  notes: string[];
  setScenes: (scenes: Scene[]) => void;
  setCurrentSceneIndex: (index: number) => void;
  nextScene: () => void;
  prevScene: () => void;
  setPlaying: (playing: boolean) => void;
  setShowWhiteboard: (show: boolean) => void;
  addWhiteboardElement: (element: any) => void;
  clearWhiteboard: () => void;
  addNote: (note: string) => void;
  reset: () => void;
}

const initialState = {
  scenes: [],
  currentSceneIndex: 0,
  isPlaying: false,
  showWhiteboard: false,
  whiteboardElements: [],
  notes: [],
};

export const usePlaybackStore = create<PlaybackState>((set) => ({
  ...initialState,
  setScenes: (scenes) => set({ scenes, currentSceneIndex: 0 }),
  setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),
  nextScene: () => set((state) => {
    const nextIndex = state.currentSceneIndex + 1;
    if (nextIndex < state.scenes.length) {
      return { currentSceneIndex: nextIndex };
    }
    return state;
  }),
  prevScene: () => set((state) => {
    const prevIndex = state.currentSceneIndex - 1;
    if (prevIndex >= 0) {
      return { currentSceneIndex: prevIndex };
    }
    return state;
  }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setShowWhiteboard: (show) => set({ showWhiteboard: show }),
  addWhiteboardElement: (element) => set((state) => ({
    whiteboardElements: [...state.whiteboardElements, element],
  })),
  clearWhiteboard: () => set({ whiteboardElements: [] }),
  addNote: (note) => set((state) => ({
    notes: [...state.notes, note],
  })),
  reset: () => set(initialState),
}));