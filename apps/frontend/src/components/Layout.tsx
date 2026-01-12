import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { useEffect } from 'react';

export function Layout() {
  const { user, setAuth, clearAuth } = useAuthStore();

  const { data: session } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
    enabled: !user,
  });

  useEffect(() => {
    if (session) {
      setAuth(session.user, session.permissions, session.belongsToOrg);
    }
  }, [session, setAuth]);

  const handleLogout = async () => {
    await authApi.logout();
    clearAuth();
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
                  to="/search"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Search Assets
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
