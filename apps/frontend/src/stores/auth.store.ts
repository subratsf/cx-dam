import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, GitHubRepoPermission } from '@cx-dam/shared';

interface AuthState {
  user: User | null;
  permissions: GitHubRepoPermission[];
  belongsToOrg: boolean;
  isAuthenticated: boolean;
  hasCheckedAuth: boolean;
  setAuth: (
    user: User,
    permissions: GitHubRepoPermission[],
    belongsToOrg: boolean
  ) => void;
  clearAuth: () => void;
  markAuthChecked: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: [],
      belongsToOrg: false,
      isAuthenticated: false,
      hasCheckedAuth: false,
      setAuth: (user, permissions, belongsToOrg) =>
        set({ user, permissions, belongsToOrg, isAuthenticated: true, hasCheckedAuth: true }),
      clearAuth: () =>
        set({ user: null, permissions: [], belongsToOrg: false, isAuthenticated: false, hasCheckedAuth: false }),
      markAuthChecked: () => set({ hasCheckedAuth: true }),
    }),
    {
      name: 'cx-dam-auth',
    }
  )
);
