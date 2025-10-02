import { createContext, useContext, useState, useEffect } from "react";
import {
  login as loginService,
  logout as logoutService,
  getMe,
} from "../services/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage with logs
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      console.log("[AuthContext] Stored user from localStorage:", storedUser);
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (err) {
      console.error("[AuthContext] Error parsing user from localStorage:", err);
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem("token");
    console.log("[AuthContext] Stored token from localStorage:", storedToken);
    return storedToken || null;
  });

  // Verify token in background with logs
  useEffect(() => {
    const verifyUser = async (retries = 2, delay = 1000) => {
      if (!token) {
        console.log("[AuthContext] No token found, skipping verification");
        return;
      }

      try {
        console.log("[AuthContext] Verifying token with getMe...");
        const data = await getMe(token);
        console.log("[AuthContext] getMe response:", data);
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
        setUser(null);
        setToken(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    };

    verifyUser();
  }, [token]);

  const loginUser = async (credentials) => {
    console.log("[AuthContext] loginUser called with:", credentials);
    const data = await loginService(credentials);
    console.log("[AuthContext] loginUser response:", data);
    if (data.token) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  };

  const logoutUser = async () => {
    console.log("[AuthContext] logoutUser called");
    try {
      await logoutService();
    } catch (err) {
      console.error("[AuthContext] logoutService error:", err.message);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    console.log("[AuthContext] Auth state cleared");
  };

  console.log("[AuthContext] Rendering provider, user:", user, "token:", token);

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
