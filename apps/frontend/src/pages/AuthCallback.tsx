import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { useAuthLoadingStore } from '../stores/authLoading.store';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { setAuthenticating, setToast } = useAuthLoadingStore();

  const authStatus = searchParams.get('auth');

  const { data: session, isLoading } = useQuery({
    queryKey: ['auth', 'callback'],
    queryFn: authApi.getMe,
    enabled: authStatus === 'success',
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authStatus === 'failed') {
      setAuthenticating(false);
      setToast({
        type: 'error',
        message: 'Authentication failed. Please try again.',
      });
      navigate('/');
      return;
    }

    if (session) {
      setAuth(session.user, session.permissions, session.belongsToOrg);
      setAuthenticating(false);
      setToast({
        type: 'success',
        message: `Welcome back, ${session.user.login}! Authentication successful.`,
      });
      navigate('/');
    }
  }, [authStatus, session, setAuth, setAuthenticating, setToast, navigate]);

  if (isLoading) {
    return (
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
    );
  }

  return null;
}
