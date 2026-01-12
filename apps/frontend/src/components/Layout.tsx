import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import React, { useEffect } from 'react';

export function Layout() {
  const { user, setAuth, clearAuth, hasCheckedAuth, markAuthChecked } = useAuthStore();

  // Only check auth once if we don't have a user and haven't checked yet
  const shouldCheckAuth = !user && !hasCheckedAuth;

  const { data: session, isError, isSuccess } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
    enabled: shouldCheckAuth,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (session) {
      setAuth(session.user, session.permissions, session.belongsToOrg);
    }
  }, [session, setAuth]);

  // Mark as checked even on error to prevent infinite retries
  useEffect(() => {
    if ((isError || isSuccess) && !hasCheckedAuth) {
      markAuthChecked();
    }
  }, [isError, isSuccess, hasCheckedAuth, markAuthChecked]);

  const handleLogout = async () => {
    await authApi.logout();
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold text-blue-600">CX DAM</span>
              </Link>
              <div className="ml-10 flex items-center space-x-4">
                <Link
                  to="/"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Search
                </Link>
                {user && (
                  <Link
                    to="/upload"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Upload
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <div className="flex items-center space-x-4">
                  <img
                    src={user.avatarUrl || ''}
                    alt={user.login}
                    className="h-8 w-8 rounded-full"
                  />
                  <span className="text-sm text-gray-700">{user.login}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-700 hover:text-blue-600"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <a
                  href={authApi.getLoginUrl()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Login with GitHub
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
