import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getUser, isAuthenticated, ensureValidToken } from '../services/auth';
import { AUTH_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser);
  const [authed, setAuthed] = useState(isAuthenticated);
  const [loading, setLoading] = useState(true);

  // On mount: if user has tokens, auto-refresh if access expired (3d access / 7d refresh)
  useEffect(() => {
    if (!isAuthenticated()) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    ensureValidToken()
      .catch(() => true) // never leave the app blank on an unexpected error
      .then((valid) => {
        if (cancelled) return;
        if (!valid) {
          setUser(null);
          setAuthed(false);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Keep tabs in sync: signing out (or in) in another tab updates this one.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && e.key !== 'access_token' && e.key !== 'user') return;
      setAuthed(isAuthenticated());
      setUser(getUser());
    };
    // The API client signals a session that could not be refreshed.
    const onExpired = () => {
      setAuthed(false);
      setUser(null);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    setUser({ username: data.username, email: data.email, organization: data.organization, role: data.role });
    setAuthed(true);
    return data;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setAuthed(false);
  }, []);

  // Show nothing while checking token validity
  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
