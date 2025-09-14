import React, { useState } from "react";
import Sidebar from "../../components/cashier/layout/Sidebar";
import SelectCard from "../../components/cashier/SelectCard";
import CashierReport from "../../components/cashier/Report";

const CashierDashboard = () => {
  const [selected, setSelected] = useState("selectCard");

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar selected={selected} setSelected={setSelected} />

      {/* Main Content */}
      <div className="flex-1 p-6">
        {selected === "selectCard" && <SelectCard />}
        {selected === "report" && <CashierReport />}
      </div>
    </div>
  );
};

export default CashierDashboard;
