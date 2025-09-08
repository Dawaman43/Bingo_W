import { Home, Users, FileText, X } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function ModeratorSidebar({ isOpen, toggleSidebar }) {
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
      <h2 className="text-2xl font-bold text-green-400 mb-8">Moderator Panel</h2>

      {/* Navigation */}
      <nav className="flex flex-col gap-4 flex-1">
        <NavLink
          to="/moderator-dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 p-2 rounded transition ${
              isActive ? "bg-green-600 text-white" : "hover:bg-gray-800"
            }`
          }
          onClick={toggleSidebar}
          end
        >
          <Home size={20} /> Control Game
        </NavLink>


        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `flex items-center gap-3 p-2 rounded transition ${
              isActive ? "bg-green-600 text-white" : "hover:bg-gray-800"
            }`
          }
          onClick={toggleSidebar}
        >
          <FileText size={20} />Jack Pot Reports
        </NavLink>
      </nav>
    </div>
  );
}
