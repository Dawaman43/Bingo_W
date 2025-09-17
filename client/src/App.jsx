import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { Toaster } from "react-hot-toast";
import Login from "./pages/auth/Login";
import AddUser from "./pages/admin/AddUser";
import Control from "./pages/moderator/Control";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/admin/Dashboard";
import AdminReport from "./pages/admin/Report";
import BingoGame from "./components/bingo/BingoGame";
import CashierDashboard from "./pages/cashier/cashier";
import SelectCard from "./components/cashier/SelectCard";
import CashierReport from "./components/cashier/Report";
import JackpotManager from "./pages/moderator/Jackpot";

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes group */}
        <Route element={<ProtectedRoute />}>
          {/* Cashier */}
          <Route path="/cashier-dashboard" element={<CashierDashboard />} />
          <Route path="/cashier-report" element={<CashierReport />} />
          <Route path="/select-card" element={<SelectCard />} />
          <Route path="/bingo-game" element={<BingoGame />} />

          {/* Admin */}
          <Route path="/add-user" element={<AddUser />} />
          <Route path="/admin-dashboard" element={<Dashboard />} />
          <Route path="/admin-report" element={<AdminReport />} />

          {/* Moderator */}
          <Route path="/control" element={<Control />} />
          <Route path="/jackpot" element={<JackpotManager />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
