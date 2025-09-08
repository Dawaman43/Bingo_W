import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedRole = location.state?.role; // e.g., "admin"

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser({ email, password });

      if (data?.success) {
        const userRole = (data.user?.role || "").toLowerCase();

        // Check if logged-in role matches the selected card
        if (selectedRole && selectedRole !== userRole) {
          toast.error(
            `Access denied! You cannot login as ${selectedRole}. Your role is ${userRole}.`
          );
          return; // stop further navigation
        }

        toast.success("Login successful!");

        // Navigate based on user role
        if (userRole === "admin") navigate("/admin-dashboard");
        else if (userRole === "cashier") navigate("/select-card");
        else if (userRole === "moderator") navigate("/moderator");
        else navigate("/");
      } else {
        toast.error(data?.message || "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleResetSubmit = (e) => {
    e.preventDefault();
    console.log("Password reset request for:", resetEmail);
    toast.success("Password reset link sent to your email 📩");
    setShowResetModal(false);
    setResetEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-black to-gray-900 text-white">
      <div className="w-full max-w-md bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-xl border border-gray-700 relative">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-blue-400 mb-6">
          Bingo Login
        </h1>

        {/* Form */}
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
              onClick={() => setShowResetModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              ×
            </button>

            <h2 className="text-xl font-semibold text-blue-400 mb-4 text-center">
              Reset Password
            </h2>
            <form onSubmit={handleResetSubmit} className="space-y-4">
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
                Send Reset Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
