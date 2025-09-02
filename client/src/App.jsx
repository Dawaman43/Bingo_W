import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Logout from "./pages/auth/Logout";
import Report from "./pages/cashier/Report";
import SelectCard from "./pages/cashier/SelectCard";
import ForgetPassword from "./pages/auth/ForgetPassword";
import AddUser from "./pages/admin/AddUser";
import Control from "./pages/moderator/Control";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes group */}
      <Route element={<ProtectedRoute />}>
        <Route path="/logout" element={<Logout />} />
        <Route path="/forget-password" element={<ForgetPassword />} />

        {/* Cashier */}
        <Route path="/report" element={<Report />} />
        <Route path="/select-card" element={<SelectCard />} />

        {/* Admin */}
        <Route path="/add-user" element={<AddUser />} />

        {/* Moderator */}
        <Route path="/control" element={<Control />} />
      </Route>
    </Routes>
  );
}

export default App;
