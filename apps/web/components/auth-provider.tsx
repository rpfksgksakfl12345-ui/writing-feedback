"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  grade?: number | null;
};

type AuthContextValue = {
  token: string | null;
  user: SessionUser | null;
  isReady: boolean;
  login: (token: string, user: SessionUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token");
    const storedUser = window.localStorage.getItem("user");

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    setIsReady(true);
  }, []);

  function login(nextToken: string, nextUser: SessionUser) {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem("token", nextToken);
    window.localStorage.setItem("user", JSON.stringify(nextUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
  }

  return (
    <AuthContext.Provider value={{ token, user, isReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
