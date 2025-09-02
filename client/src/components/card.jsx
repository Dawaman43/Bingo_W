import React from "react";
import { useNavigate } from "react-router-dom";

const Card = ({ title, description, link }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(link)}
      className="cursor-pointer bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-lg border border-gray-700 
                 hover:shadow-blue-500/50 hover:scale-105 transform transition-all duration-300 ease-in-out"
    >
      <h2 className="text-2xl font-semibold text-blue-400 mb-3">{title}</h2>
      <p className="text-gray-300">{description}</p>
    </div>
  );
};

export default Card;
