import React from "react";
import { useNavigate } from "react-router-dom";

const Card = ({ title, description, link }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(link)}
      className="cursor-pointer p-6 border rounded-2xl shadow-md hover:shadow-lg transition"
    >
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default Card;
