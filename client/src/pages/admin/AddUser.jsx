import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { addUser } from "../../services/admin";

const AddUserPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    cashier: { name: "", email: "", password: "", role: "cashier" },
    moderator: { name: "", email: "", password: "", role: "moderator" },
  });

  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleChange = (e, type) => {
    setFormData({
      ...formData,
      [type]: {
        ...formData[type],
        [e.target.name]: e.target.value,
      },
    });
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addUser(formData);
      toast.success("Cashier and Moderator added successfully!");
      setFormData({
        cashier: { name: "", email: "", password: "", role: "cashier" },
        moderator: { name: "", email: "", password: "", role: "moderator" },
      });

      setTimeout(() => navigate("/admin-dashboard"), 1500);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error adding users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-black to-gray-900 p-6">
      <div className="bg-white/10 backdrop-blur-xl border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-lg relative text-white">
        {/* Back to Dashboard */}
        <button
          onClick={() => navigate("/admin-dashboard")}
          className="absolute top-4 left-4 flex items-center gap-2 text-blue-400 hover:text-blue-200 cursor-pointer"
        >
          <FaArrowLeft /> Back
        </button>

        <h2 className="text-3xl font-bold text-center mb-8 text-blue-400">
          Add Cashier and Moderator
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Cashier Section */}
          <h3 className="text-xl font-semibold text-gray-200">
            Cashier Details
          </h3>
          <div>
            <label className="block mb-2 font-medium text-gray-200">Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter cashier name"
              value={formData.cashier.name}
              onChange={(e) => handleChange(e, "cashier")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-gray-200">
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="Enter cashier email"
              value={formData.cashier.email}
              onChange={(e) => handleChange(e, "cashier")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-gray-200">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="Enter cashier password"
              value={formData.cashier.password}
              onChange={(e) => handleChange(e, "cashier")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Moderator Section */}
          <h3 className="text-xl font-semibold text-gray-200 mt-6">
            Moderator Details
          </h3>
          <div>
            <label className="block mb-2 font-medium text-gray-200">Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter moderator name"
              value={formData.moderator.name}
              onChange={(e) => handleChange(e, "moderator")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-gray-200">
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="Enter moderator email"
              value={formData.moderator.email}
              onChange={(e) => handleChange(e, "moderator")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-gray-200">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="Enter moderator password"
              value={formData.moderator.password}
              onChange={(e) => handleChange(e, "moderator")}
              required
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold shadow-lg transition-all cursor-pointer"
          >
            {loading ? "Adding..." : "Add Users"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddUserPage;
