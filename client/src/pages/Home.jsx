import React from "react";
import Card from "../components/card";

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 via-black to-gray-900 text-white">
      {/* Main content */}
      <div className="flex-grow p-8">
        {/* Title + description */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-4 text-blue-400 drop-shadow-lg">
            Welcome to Dagi Bingo
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Choose your role to get started. Click any card below to explore the pages.
          </p>
        </div>

        {/* 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card
            title="Admin"
            description="Login as admin"
            link="/login"
            role="admin"
          />
          <Card
            title="Cashier"
            description="Manages games and daily operations"
            link="/login"
            role="cashier"
          />
          <Card
            title="Moderator"
            description="Moderates the platform"
            link="/login"
            role="moderator"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/70 py-6 shadow-inner text-center border-t border-gray-800">
        <p className="text-gray-400 text-sm">
          © {new Date().getFullYear()} Dagi Bingo. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Home;
