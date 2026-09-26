import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import AppLayout from './pages/Layout';
import { fetchMe, TOKEN_KEY, type Me } from './api';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setMe)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setMe} />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout
      me={me}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setMe(null);
      }}
    />
  );
}
