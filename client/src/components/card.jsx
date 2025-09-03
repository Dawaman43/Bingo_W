import React from "react";
import { useNavigate } from "react-router-dom";

const Card = ({ title, description, role }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to login and pass the selected role in state
    navigate("/login", { state: { role } });
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-lg border border-gray-700 
                 hover:shadow-blue-500/50 hover:scale-105 transform transition-all duration-300 ease-in-out"
    >
      <h2 className="text-2xl font-semibold text-blue-400 mb-3">{title}</h2>
      <p className="text-gray-300">{description}</p>
    </div>
  );
};

export default Card;
