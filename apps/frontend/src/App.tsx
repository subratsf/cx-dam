import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import { AuthCallback } from './pages/AuthCallback';

function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<SearchPage />} />
          <Route path="about" element={<HomePage />} />
          <Route
            path="upload"
            element={user ? <UploadPage /> : <Navigate to="/" replace />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
