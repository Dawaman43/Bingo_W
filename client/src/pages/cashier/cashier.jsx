import React, { useState, useEffect } from "react";
import Sidebar from "../../components/cashier/layout/Sidebar";
import SelectCard from "../../components/cashier/SelectCard";
import CashierReport from "../../components/cashier/Report";
import { useAuth } from "../../context/AuthContext";

const CashierDashboard = () => {
  const [selected, setSelected] = useState("selectCard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default
  const { user } = useAuth();

  const [dateTime, setDateTime] = useState(new Date());

  // auto update time every second
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Greeting
  const hour = dateTime.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Format time & date
  const formattedTime = dateTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDate = dateTime.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Map selected key to display name
  const pageTitles = {
    selectCard: "Select Card",
    report: "Cashier Report",
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-950 overflow-hidden transition-colors">
      {/* Sidebar */}
      <div
        className={`fixed h-full bg-white dark:bg-gray-900 shadow-lg transition-all duration-300 z-50 ${
          isSidebarOpen ? "w-64" : "w-0"
        } overflow-hidden`}
      >
        <Sidebar
          selected={selected}
          setSelected={setSelected}
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      {/* Overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area - Full width when sidebar is collapsed */}
      <div
        className={`flex-1 h-full w-full overflow-auto transition-all duration-300 ${
          isSidebarOpen ? "ml-64" : "ml-0"
        }`}
      >
        {/* Full Header */}
        <header className="bg-white dark:bg-gray-900 shadow-md p-4 flex justify-between items-center sticky top-0 z-10 animate-fade-in w-full">
          {/* Left side (Menu Button + Title + Greeting) */}
          <div className="flex items-center space-x-4">
            {/* Menu Button - Always show */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-200"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {pageTitles[selected] || "Dashboard"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {greeting}, welcome to the Cashier Panel
              </p>
            </div>
          </div>

          {/* Right side (User info + Time/Date) */}
          <div className="flex items-center space-x-6">
            {/* Time and Date */}
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {formattedTime}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formattedDate}
              </p>
            </div>

            {/* User Info */}
            {user ? (
              <div className="flex items-center space-x-2">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-gray-800 dark:text-gray-100 font-medium">
                    {user.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {user.role}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                  G
                </div>
                <div>
                  <p className="text-gray-800 dark:text-gray-100 font-medium">
                    Guest
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No Role
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div className="h-[calc(100vh-64px)] w-full bg-white dark:bg-gray-950 animate-fade-in">
          {selected === "selectCard" && <SelectCard />}
          {selected === "report" && <CashierReport />}
        </div>
      </div>
    </div>
  );
};

export default CashierDashboard;
