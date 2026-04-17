import { create } from 'zustand';

interface Classroom {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface ClassroomState {
  classrooms: Classroom[];
  currentClassroom: Classroom | null;
  isLoading: boolean;
  error: string | null;
  setClassrooms: (classrooms: Classroom[]) => void;
  setCurrentClassroom: (classroom: Classroom | null) => void;
  addClassroom: (classroom: Classroom) => void;
  removeClassroom: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useClassroomStore = create<ClassroomState>((set) => ({
  classrooms: [],
  currentClassroom: null,
  isLoading: false,
  error: null,
  setClassrooms: (classrooms) => set({ classrooms, isLoading: false, error: null }),
  setCurrentClassroom: (classroom) => set({ currentClassroom: classroom }),
  addClassroom: (classroom) => set((state) => ({
    classrooms: [classroom, ...state.classrooms],
  })),
  removeClassroom: (id) => set((state) => ({
    classrooms: state.classrooms.filter((c) => c.id !== id),
    currentClassroom: state.currentClassroom?.id === id ? null : state.currentClassroom,
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}));