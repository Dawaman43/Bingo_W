import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { forgotPassword, resetPassword } from "../../services/auth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedRole = location.state?.role;

  // Forgot/Reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter otp + new password
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Handle Login
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser({ email, password });

      if (data?.success) {
        const userRole = (data.user?.role || "").toLowerCase();

        if (selectedRole && selectedRole !== userRole) {
          toast.error(
            `Access denied! You cannot login as ${selectedRole}. Your role is ${userRole}.`
          );
          return;
        }

        toast.success("Login successful!");

        if (userRole === "admin") navigate("/admin-dashboard");
        else if (userRole === "cashier") navigate("/select-card");
        else if (userRole === "moderator") navigate("/control");
        else navigate("/");
      } else {
        toast.error(data?.message || "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  // Step 1: Send OTP
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await forgotPassword(resetEmail);
      toast.success(res.message || "OTP sent to your email 📩");
      setStep(2); // move to next step
    } catch (err) {
      toast.error(err.response?.data?.message || "Error sending OTP");
    }
  };

  // Step 2: Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await resetPassword({ email: resetEmail, otp, newPassword });
      toast.success(res.message || "Password reset successful!");
      setShowResetModal(false);
      setStep(1);
      setResetEmail("");
      setOtp("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Error resetting password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-black to-gray-900 text-white">
      <div className="w-full max-w-md bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-xl border border-gray-700 relative">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-blue-400 mb-6">
          Bingo Login
        </h1>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition text-white font-semibold shadow-lg hover:shadow-blue-500/50 cursor-pointer"
          >
            Login
          </button>
        </form>

        {/* Forgot Password */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm text-blue-400 hover:underline cursor-pointer"
          >
            Forgot Password?
          </button>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl w-full max-w-sm border border-gray-700">
            <button
              onClick={() => {
                setShowResetModal(false);
                setStep(1);
                setResetEmail("");
                setOtp("");
                setNewPassword("");
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              ×
            </button>

            <h2 className="text-xl font-semibold text-blue-400 mb-4 text-center">
              {step === 1 ? "Forgot Password" : "Reset Password"}
            </h2>

            {/* Step 1: Enter Email */}
            {step === 1 && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition text-white font-semibold shadow-lg hover:shadow-blue-500/50 cursor-pointer"
                >
                  Send OTP
                </button>
              </form>
            )}

            {/* Step 2: Enter OTP + New Password */}
            {step === 2 && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  required
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 transition text-white font-semibold shadow-lg hover:shadow-green-500/50 cursor-pointer"
                >
                  Reset Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
