import { useState } from "react";
import ModeratorSidebar from "./ModeratorSidebar";
import ModeratorNavbar from "./ModeratorNavbar";

export default function ModeratorLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex">
      <ModeratorSidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex-1 flex flex-col min-h-screen">
        <ModeratorNavbar toggleSidebar={toggleSidebar} />
        <main className="p-6 bg-gray-100 flex-1">{children}</main>
      </div>
    </div>
  );
}
