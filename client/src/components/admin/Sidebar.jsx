import { Home, UserPlus, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function Sidebar({ isOpen, toggleSidebar }) {
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
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition"
          onClick={toggleSidebar}
        >
          <Home size={20} /> Dashboard
        </Link>
        <Link
          to="/admin/add-user"
          className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition"
          onClick={toggleSidebar}
        >
          <UserPlus size={20} /> Add User
        </Link>
      </nav>
    </div>
  );
}
