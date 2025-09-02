import React from "react";
import Card from "../components/card";

const Home = () => {
  return (
    <div className="p-8">
      {/* Title + description */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Welcome to Dagi Bingo</h1>
        <p className="text-gray-600">
           Click any card below to
          explore the pages.
        </p>
      </div>

      {/* 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          title="Admin"
          description="Login as admin"
          link="/admin"
        />
        <Card
          title="Cashier"
          description="Manages games and daily operation"
          link="/cashier"
        />
        <Card
          title="Moderator"
          description="Moderates the platform"
          link="/moderator"
        />
      </div>
    </div>
  );
};

export default Home;
