"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, logoutUser, registerUser, refreshToken } from "@/services/authService";
import { getSession, setSession, clearSession } from "@/utils/session";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getSession()?.user || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await refreshToken();
        console.log(session);
        setSession(session);
        setUser(session.user);
      } catch {
        // clearSession();
        // setUser(null);
      }
    };
    init();
  }, []);

const login = async (credentials) => {
  setLoading(true);
  try {
    const res = await loginUser(credentials); 

    const session = {
      user: res?.data?.user,
      accessToken: res?.data?.tokens?.accessToken,
      refreshToken: res?.data?.tokens?.refreshToken,
    };

    setSession(session);
    setUser(session.user);

    return session;
  } finally {
    setLoading(false);
  }
};


  const register = async (data) => {
    setLoading(true);
    try {
      const res = await registerUser(data);
      setSession(res);
      setUser(res.user);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
