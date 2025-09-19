import { createContext, useContext, useState, useEffect } from "react";
import {
  login as loginService,
  logout as logoutService,
  getMe,
} from "../services/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );
  const [loading, setLoading] = useState(true);

  // Verify token on mount with retry
  useEffect(() => {
    const verifyUser = async (retries = 2, delay = 1000) => {
      if (!token) {
        console.log("[AuthContext] No token found in localStorage");
        setLoading(false);
        return;
      }
      try {
        console.log("[AuthContext] Verifying token with getMe...");
        const data = await getMe(token);
        console.log(
          "[AuthContext] getMe response:",
          JSON.stringify(data, null, 2)
        );
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (err) {
        console.error("[AuthContext] getMe failed:", {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        });
        if (retries > 0) {
          console.log(
            `[AuthContext] Retrying getMe (${retries} attempts left)...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return verifyUser(retries - 1, delay * 2);
        }
        console.warn("[AuthContext] All retries failed, clearing auth state");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  const loginUser = async (credentials) => {
    try {
      console.log("[AuthContext] Logging in with credentials:", credentials);
      const data = await loginService(credentials);
      console.log(
        "[AuthContext] Login response:",
        JSON.stringify(data, null, 2)
      );
      if (data.token) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      return data;
    } catch (err) {
      console.error("[AuthContext] Login failed:", err.message);
      throw err;
    }
  };

  const logoutUser = async () => {
    try {
      console.log("[AuthContext] Logging out...");
      await logoutService();
    } catch (err) {
      console.error("[AuthContext] Logout error:", err.message);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    console.log("[AuthContext] Auth state cleared");
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loginUser, logoutUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
