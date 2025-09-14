import React from "react";

const Sidebar = ({ selected, setSelected }) => {
  const menuItems = [
    { key: "selectCard", label: "Select Card" },
    { key: "report", label: "Cashier Report" },
  ];

  return (
    <div className="w-64 h-screen bg-gray-800 text-white p-4">
      <h2 className="text-2xl font-bold mb-6">Cashier Panel</h2>
      <ul className="space-y-4">
        {menuItems.map((item) => (
          <li
            key={item.key}
            onClick={() => setSelected(item.key)}
            className={`cursor-pointer p-2 rounded-md ${
              selected === item.key
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-700"
            }`}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
