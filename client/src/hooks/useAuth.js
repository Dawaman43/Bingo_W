import { useState, useEffect } from "react";
import {
  login as loginService,
  logout as logoutService,
} from "../services/auth";

export const useAuth = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        const storedUser = JSON.parse(sessionStorage.getItem("user"));
        setUser(storedUser || null);
      } catch (err) {
        console.error("Failed to parse stored user:", err);
        setUser(null);
      }
    }
  }, []);

  const login = async (data) => {
    try {
      const response = await loginService(data);
      if (response.user) {
        setUser(response.user);
        sessionStorage.setItem("user", JSON.stringify(response.user));
      }
      return response;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutService();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
  };

  return { user, login, logout };
};
