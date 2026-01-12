import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const authStatus = searchParams.get('auth');

  const { data: session, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    enabled: authStatus === 'success',
    retry: false,
  });

  useEffect(() => {
    if (authStatus === 'failed') {
      navigate('/?error=auth_failed');
      return;
    }

    if (session) {
      setAuth(session.user, session.permissions, session.belongsToOrg);
      navigate('/');
    }
  }, [authStatus, session, setAuth, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  return null;
}
