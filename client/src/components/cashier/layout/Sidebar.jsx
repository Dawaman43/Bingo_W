import { useAuth } from "../../../context/AuthContext";

const Sidebar = ({ selected, setSelected, isOpen, toggleSidebar }) => {
  const { logoutUser } = useAuth();

  const menuItems = [
    {
      key: "selectCard",
      label: "Select Card",
      icon: (
        <svg
          className="w-8 h-8" // Larger icons for better clickability
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      ),
    },
    {
      key: "report",
      label: "Cashier Report",
      icon: (
        <svg
          className="w-8 h-8" // Larger icons for better clickability
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`h-full bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col justify-between overflow-hidden shadow-lg transition-width duration-300 ${
        !isOpen && "w-20" // Fixed width for collapsed state
      }`}
    >
      {/* Header with Toggle Button */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {isOpen && (
            <h2 className="text-xl font-bold tracking-wide animate-slide-in">
              Cashier Panel
            </h2>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-700 focus:outline-none transition-colors cursor-pointer"
          >
            {isOpen ? (
              <svg
                className="w-7 h-7 text-gray-300 hover:text-white transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            ) : (
              <svg
                className="w-7 h-7 text-gray-300 hover:text-white transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Menu Items (open) */}
        {isOpen && (
          <ul className="mt-6 space-y-2">
            {menuItems.map((item) => (
              <li
                key={item.key}
                onClick={() => setSelected(item.key)}
                className={`flex items-center px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  selected === item.key
                    ? "bg-blue-600 text-white shadow-md"
                    : "hover:bg-gray-700"
                }`}
              >
                {item.icon}
                <span className="ml-3 text-sm font-medium">{item.label}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Menu Items (collapsed) */}
        {!isOpen && (
          <ul className="mt-6 space-y-2">
            {menuItems.map((item) => (
              <li
                key={item.key}
                onClick={() => setSelected(item.key)}
                className={`flex justify-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  selected === item.key
                    ? "bg-blue-600 text-white shadow-md"
                    : "hover:bg-gray-700"
                }`}
                title={item.label} // Tooltip for accessibility
              >
                <div className="flex items-center justify-center w-8 h-8">
                  {item.icon}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logoutUser}
          className={`flex items-center p-3 rounded-lg w-full transition-colors duration-200 cursor-pointer ${
            isOpen ? "justify-start" : "justify-center"
          } bg-red-600 hover:bg-red-700 shadow-md`}
          title={isOpen ? "" : "Logout"} // Tooltip for collapsed state
        >
          <div className="flex items-center justify-center w-8 h-8">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1"
              />
            </svg>
          </div>
          {isOpen && <span className="ml-3 font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
