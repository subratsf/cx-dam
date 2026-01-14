import { create } from 'zustand';

export interface Toast {
  type: 'success' | 'error';
  message: string;
}

interface AuthLoadingState {
  isAuthenticating: boolean;
  toast: Toast | null;
  setAuthenticating: (isAuthenticating: boolean) => void;
  setToast: (toast: Toast | null) => void;
}

export const useAuthLoadingStore = create<AuthLoadingState>((set) => ({
  isAuthenticating: false,
  toast: null,
  setAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
  setToast: (toast) => set({ toast }),
}));
