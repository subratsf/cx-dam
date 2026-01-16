import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { useAuthLoadingStore } from '../stores/authLoading.store';
import { Toast } from './Toast';
import React, { useEffect, useState, useRef } from 'react';

export function Layout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, permissions, belongsToOrg, setAuth, clearAuth, hasCheckedAuth, markAuthChecked } = useAuthStore();
  const { isAuthenticating, toast, setAuthenticating, setToast } = useAuthLoadingStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRepoPermissionsModal, setShowRepoPermissionsModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localPermissions, setLocalPermissions] = useState(permissions);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSearchPage = location.pathname === '/';
  const isUploadPage = location.pathname === '/upload';

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
      console.log('Auth session received:', { user: session.user.login, hasPermissions: session.permissions.length > 0 });
      setAuth(session.user, session.permissions, session.belongsToOrg);
    }
  }, [session, setAuth]);

  // Mark as checked even on error to prevent infinite retries
  useEffect(() => {
    if ((isError || isSuccess) && !hasCheckedAuth) {
      markAuthChecked();
    }
  }, [isError, isSuccess, hasCheckedAuth, markAuthChecked]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      const tokenData = await authApi.generateToken();
      setGeneratedToken(tokenData.token);
      setShowTokenModal(true);
      setShowUserMenu(false);
    } catch (error) {
      console.error('Failed to generate token:', error);
      setToast({
        type: 'error',
        message: 'Failed to generate access token',
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(generatedToken);
    setToast({
      type: 'success',
      message: 'Token copied to clipboard!',
    });
  };

  const handleLogout = async () => {
    try {
      // Call logout API to clear backend session and cache
      await authApi.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    }

    // Clear Zustand auth store (also clears localStorage due to persist middleware)
    clearAuth();

    // Clear React Query cache
    queryClient.clear();

    // Clear any other localStorage items
    localStorage.removeItem('cx-dam-auth');

    // Redirect to home page (hard reload to ensure clean state)
    window.location.href = '/';
  };

  const handleRefreshPermissions = async () => {
    setIsRefreshing(true);
    try {
      const result = await authApi.refreshPermissions();
      // Update local permissions
      setLocalPermissions(result.permissions);
      // Update auth store
      if (user) {
        setAuth(user, result.permissions, belongsToOrg);
      }
      console.log(`✅ Successfully refreshed! Found ${result.count} repositories.`);
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
      alert('❌ Failed to refresh permissions. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update local permissions when store changes
  useEffect(() => {
    setLocalPermissions(permissions);
  }, [permissions]);

  // Note: Polling removed - permissions are now fetched synchronously during login
  // No need to poll since users will have permissions immediately after OAuth callback

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-600 rounded-lg blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    CX DAM
                  </span>
                  <span className="text-[10px] text-gray-500 -mt-1">Digital Asset Manager</span>
                </div>
              </Link>

              <div className="hidden md:flex items-center space-x-1">
                <Link
                  to="/"
                  className={`group flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isSearchPage
                      ? 'text-blue-600 bg-blue-50 shadow-sm'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg
                    className={`h-4 w-4 transition-colors ${
                      isSearchPage ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>Search</span>
                </Link>
                {user && (
                  <Link
                    to="/upload"
                    className={`group flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isUploadPage
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <svg
                      className={`h-4 w-4 transition-colors ${
                        isUploadPage ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span>Upload</span>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 focus:outline-none hover:bg-gray-100 rounded-full p-1 pr-3 transition-colors"
                  >
                    <div className="relative h-8 w-8">
                      <img
                        src={user.avatarUrl || `https://github.com/${user.login}.png`}
                        alt={user.login}
                        className="h-8 w-8 rounded-full ring-2 ring-gray-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = `https://ui-avatars.com/api/?name=${user.login}&background=3b82f6&color=fff&bold=true`;
                        }}
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                        <svg
                          className="h-3 w-3 text-gray-700"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.login}</span>
                    <svg
                      className={`h-4 w-4 text-gray-500 transition-transform ${
                        showUserMenu ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <img
                              src={user.avatarUrl || `https://github.com/${user.login}.png`}
                              alt={user.login}
                              className="h-10 w-10 rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${user.login}&background=3b82f6&color=fff&bold=true&size=40`;
                              }}
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                              <svg
                                className="h-3.5 w-3.5 text-gray-700"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.name || user.login}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setShowUserModal(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <svg
                          className="h-4 w-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span>View Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRepoPermissionsModal(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <svg
                          className="h-4 w-4 text-gray-500"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
                        </svg>
                        <span>Repository Permissions</span>
                      </button>

                      <button
                        onClick={handleGenerateToken}
                        disabled={isGeneratingToken}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 disabled:opacity-50"
                      >
                        <svg
                          className="h-4 w-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                          />
                        </svg>
                        <span>{isGeneratingToken ? 'Generating...' : 'Copy Token for VS Code'}</span>
                      </button>

                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthenticating(true);
                    window.location.href = authApi.getLoginUrl();
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center space-x-2"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Login with GitHub</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* User Profile Modal */}
      {showUserModal && user && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowUserModal(false);
                setRepoSearchQuery('');
              }}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Profile Details</h3>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* User Avatar and Name */}
                  <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                    <div className="relative">
                      <img
                        src={user.avatarUrl || `https://github.com/${user.login}.png`}
                        alt={user.login}
                        className="h-20 w-20 rounded-full ring-4 ring-blue-100"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = `https://ui-avatars.com/api/?name=${user.login}&background=3b82f6&color=fff&bold=true&size=80`;
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md">
                        <svg
                          className="h-5 w-5 text-gray-700"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900">
                        {user.name || user.login}
                      </h4>
                      <p className="text-sm text-gray-500">@{user.login}</p>
                      {user.email && (
                        <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                      )}
                    </div>
                  </div>

                  {/* GitHub Info */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">GitHub Account</h5>
                    <div className="bg-gray-50 rounded-md p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">GitHub ID:</span>
                        <span className="font-mono text-gray-900">{user.githubId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Organization Member:</span>
                        <span className={belongsToOrg ? 'text-green-600' : 'text-red-600'}>
                          {belongsToOrg ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  {permissions.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Access Summary</h5>
                      <div className="bg-gray-50 rounded-md p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Repositories:</span>
                          <span className="font-medium text-gray-900">{permissions.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Organization:</span>
                          <span className="font-mono text-gray-900 text-xs">salesforcedocs</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository Permissions Modal */}
      {showRepoPermissionsModal && user && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowRepoPermissionsModal(false);
                setRepoSearchQuery('');
              }}
            ></div>

            {/* Modal panel - extra large width */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-gray-900">Repository Permissions</h3>
                      <button
                        onClick={handleRefreshPermissions}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Refresh permissions from GitHub"
                      >
                        <svg
                          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Your access to repositories in the salesforcedocs organization
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRepoPermissionsModal(false);
                      setRepoSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-500 ml-4"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Stats Bar */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium uppercase mb-1">Total</p>
                      <p className="text-2xl font-bold text-blue-900">{localPermissions.length}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-xs text-red-600 font-medium uppercase mb-1">Admin</p>
                      <p className="text-2xl font-bold text-red-900">
                        {localPermissions.filter(p => p.permission === 'admin').length}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-purple-600 font-medium uppercase mb-1">Maintainer</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {localPermissions.filter(p => p.permission === 'maintainer').length}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-green-600 font-medium uppercase mb-1">Write</p>
                      <p className="text-2xl font-bold text-green-900">
                        {localPermissions.filter(p => p.permission === 'write').length}
                      </p>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      placeholder="Search repositories by name..."
                      className="w-full pl-12 pr-12 py-3 text-sm border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    {repoSearchQuery && (
                      <button
                        onClick={() => setRepoSearchQuery('')}
                        className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Results count */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {localPermissions.filter(p => p.repoFullName.toLowerCase().includes(repoSearchQuery.toLowerCase())).length} of {localPermissions.length} repositories
                    </p>
                  </div>

                  {/* Repository list */}
                  <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {localPermissions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg
                          className="h-16 w-16 mx-auto mb-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                          />
                        </svg>
                        <p className="text-lg font-medium mb-2">No Repository Access</p>
                        <p className="text-sm">You don't have access to any repositories in the salesforcedocs organization.</p>
                      </div>
                    ) : localPermissions.filter(p => p.repoFullName.toLowerCase().includes(repoSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg
                          className="h-16 w-16 mx-auto mb-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-lg font-medium mb-2">No Results Found</p>
                        <p className="text-sm">No repositories match your search "{repoSearchQuery}"</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {localPermissions
                          .filter(p => p.repoFullName.toLowerCase().includes(repoSearchQuery.toLowerCase()))
                          .map((perm, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center space-x-4 flex-1 min-w-0">
                                <svg
                                  className="h-6 w-6 text-gray-400 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {perm.repoFullName}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase flex-shrink-0 ml-4 ${
                                  perm.permission === 'admin'
                                    ? 'bg-red-100 text-red-800'
                                    : perm.permission === 'maintainer'
                                    ? 'bg-purple-100 text-purple-800'
                                    : perm.permission === 'write'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {perm.permission}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={() => {
                    setShowRepoPermissionsModal(false);
                    setRepoSearchQuery('');
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Modal for VS Code */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowTokenModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Personal Access Token
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Use this token to authenticate the VS Code extension
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Warning */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Keep this token secure!</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          This token has the same access as your account. Don't share it publicly and store it safely in VS Code.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Token Display */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Your Token</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={generatedToken}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm bg-gray-50 text-gray-900"
                        onClick={(e) => e.currentTarget.select()}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Valid for 365 days • Click the text to select all
                    </p>
                  </div>

                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">How to use:</p>
                    <ol className="text-sm text-blue-800 space-y-1.5 ml-4 list-decimal">
                      <li>Copy the token above</li>
                      <li>Open VS Code and install the "CX DAM" extension</li>
                      <li>Run command: "CX DAM: Authenticate with Token"</li>
                      <li>Paste your token when prompted</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={handleCopyToken}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
                >
                  Copy Token
                </button>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto px-4 sm:px-6 pt-8 pb-0">
        <Outlet />
      </main>

      {/* Global Auth Loading Overlay */}
      {isAuthenticating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with shadow */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

          {/* Loader container */}
          <div className="relative z-10 bg-white rounded-lg shadow-2xl p-8 max-w-sm mx-4">
            <div className="text-center">
              {/* Animated spinner */}
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin"></div>
              </div>

              {/* Loading text with pulse animation */}
              <p className="mt-6 text-lg font-medium text-gray-900 animate-pulse">
                Authenticating...
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Please wait while we verify your credentials
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
