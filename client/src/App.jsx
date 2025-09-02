import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Logout from "./pages/auth/Logout";
import SelectCard from "./pages/cashier/SelectCard";
import ForgetPassword from "./pages/auth/ForgetPassword";
import AddUser from "./pages/admin/AddUser";
import Control from "./pages/moderator/Control";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/admin/Dashboard";
import AdminReport from "./pages/admin/Report";
import CashierReport from "./pages/cashier/Report";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />


      {/* Protected routes group */}
      <Route element={<ProtectedRoute />}>
        <Route path="/logout" element={<Logout />} />
       

        {/* Cashier */}
        <Route path="/cashier-report" element={<CashierReport />} />
        <Route path="/select-card" element={<SelectCard />} />

        {/* Admin */}
        <Route path="/add-user" element={<AddUser />} />
        <Route path="/admin-dashboard" element={<Dashboard />} />
        <Route path="/admin-report" element={<AdminReport />} />

        {/* Moderator */}
        <Route path="/control" element={<Control />} />
      </Route>
    </Routes>
  );
}

export default App;
