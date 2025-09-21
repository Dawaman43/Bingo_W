// src/components/Sidebar.js (Updated)
import { Home, UserPlus, X, FileText, BarChart3, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();

  return (
    <div
      className={`fixed md:static top-0 left-0 min-h-screen w-64 bg-gray-900 text-gray-200 p-4 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 transition-transform duration-300 ease-in-out z-40 flex flex-col`}
    >
      {/* Close button (mobile only) */}
      <button
        className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
        onClick={toggleSidebar}
      >
        <X size={24} />
      </button>

      {/* Sidebar Title */}
      <h2 className="text-2xl font-bold text-blue-400 mb-8">Admin Panel</h2>

      {/* Navigation */}
      <nav className="flex flex-col gap-4 flex-1">
        <NavLink
          to="/admin-dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
              isActive
                ? "bg-blue-600 text-white shadow-lg"
                : "hover:bg-gray-800 hover:text-white"
            }`
          }
          onClick={toggleSidebar}
          end
        >
          <Home size={20} /> Dashboard
        </NavLink>

        <NavLink
          to="/add-user"
          className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
              isActive
                ? "bg-blue-600 text-white shadow-lg"
                : "hover:bg-gray-800 hover:text-white"
            }`
          }
          onClick={toggleSidebar}
        >
          <UserPlus size={20} /> Add User
        </NavLink>

        {/* Reports Section */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
            Reports
          </h3>
          <NavLink
            to="/admin-report"
            className={({ isActive }) =>
              `flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg"
                  : "hover:bg-gray-800 hover:text-white"
              }`
            }
            onClick={toggleSidebar}
          >
            <FileText size={20} /> Cashier Reports
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
