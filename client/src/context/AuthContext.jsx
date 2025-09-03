
import { createContext, useContext, useState } from "react";
import { login as loginService } from "../services/auth"

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // handle login
  const loginUser = async (credentials) => {
    try {
      const data = await loginService(credentials);
      if (data.token) {
        setUser(data.user); // assuming backend returns { user, token }
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  // handle logout
  const logoutUser = () => {
    sessionStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
