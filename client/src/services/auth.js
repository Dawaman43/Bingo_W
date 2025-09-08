import API from './axios';

// Login
export const login = async (data) => {
  const res = await API.post('/auth/login', data);
  if(res.data.token){
    sessionStorage.setItem('token', res.data.token);
  }
  return res.data; // <-- The key change: const res = just the data
};

// Logout
export const logout = async () => {
  const res = await API.post('/auth/logout');
  return res.data;
};

// Forgot Password (send OTP to email)
export const forgotPassword = async (email) => {
  const res = await API.post('/auth/forgot-password', { email });
  return res.data;
};

// Reset Password (verify OTP + set new password)
export const resetPassword = async ({ email, otp, newPassword }) => {
  const res = await API.post('/auth/reset-password', { email, otp, newPassword });
  return res.data;
};
