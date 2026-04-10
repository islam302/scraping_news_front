import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getUser, isAuthenticated, ensureValidToken } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser);
  const [authed, setAuthed] = useState(isAuthenticated);
  const [loading, setLoading] = useState(true);

  // On mount: if user has tokens, auto-refresh if access expired (3d access / 7d refresh)
  useEffect(() => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    ensureValidToken().then((valid) => {
      if (!valid) {
        setUser(null);
        setAuthed(false);
      }
      setLoading(false);
    });
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
