import { useAuth } from "../../context/AuthContext";
import { LogOut, User, Menu } from "lucide-react";
import toast from "react-hot-toast";

export default function Navbar({ toggleSidebar }) {
  const { user, logoutUser } = useAuth();

  const handleLogout = () => {
    logoutUser();
    toast.success("Logged out successfully");
  };

  return (
    <div className="w-full h-16 bg-gray-800 flex justify-between items-center px-6 shadow-md">
      {/* Mobile Sidebar Toggle */}
      <button className="md:hidden text-gray-200" onClick={toggleSidebar}>
        <Menu size={26} />
      </button>

      <h1 className="text-xl font-semibold text-white hidden md:block">
        Dashboard
      </h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-200">
          <User size={20} />
          <span>{user?.name || "Admin"}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-sm cursor-pointer"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
