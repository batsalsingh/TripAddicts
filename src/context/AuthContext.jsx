import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

function isValidToken(token) {
  return typeof token === 'string' && token.trim().length > 0;
}

function parseStoredUser(rawUser) {
  if (!rawUser || rawUser === 'undefined' || rawUser === 'null') return null;
  try {
    const parsed = JSON.parse(rawUser);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (!isValidToken(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      const parsedUser = parseStoredUser(storedUser);
      if (parsedUser) {
        setUser(parsedUser);
      } else {
        localStorage.removeItem('user');
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    if (!isValidToken(token) || !userData || typeof userData !== 'object') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
