"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();
const SESSION_KEY = "APP_SESSION";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const router = useRouter();

  // restore session
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) setUser(JSON.parse(raw));
  }, []);

  const login = async ({ email, password }) => {
    const res = await fetch("/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();
    const u = result.data.user;
    u.permissions = u.permissions.length ? u.permissions : { ADMIN: ["all"], VENDOR: ["all"], USER: ["all"] }[u.role] || [];
    setUser(u);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));

    // role redirect
    if (u.role === "ADMIN") router.push("/admin");
    else if (u.role === "VENDOR") router.push("/vendor");
    else router.push("/USER");
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
    router.push("/login");
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
