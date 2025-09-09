import API from "./axios";

// Login
export const login = async (data) => {
  const res = await API.post("/auth/login", data);
  if (res.data.token) {
    localStorage.setItem("token", res.data.token); // persist token
    localStorage.setItem("user", JSON.stringify(res.data.user)); // persist user
  }
  return res.data;
};

// Logout
export const logout = async () => {
  const res = await API.post("/auth/logout");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  return res.data;
};

// Get current user (verify token)
export const getMe = async (token) => {
  const res = await API.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Forgot Password (send OTP)
export const forgotPassword = async (email) => {
  const res = await API.post("/auth/forgot-password", { email });
  return res.data;
};

// Reset Password (verify OTP + new password)
export const resetPassword = async ({ email, otp, newPassword }) => {
  const res = await API.post("/auth/reset-password", {
    email,
    otp,
    newPassword,
  });
  return res.data;
};
