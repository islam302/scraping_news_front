import { createContext, useContext, useState, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getUser, isAuthenticated } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser);
  const [authed, setAuthed] = useState(isAuthenticated);

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

  return (
    <AuthContext.Provider value={{ user, authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
