import DashboardLayout from "../../components/admin/DashboardLayout";

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-bold mb-4">Welcome to Admin Dashboard</h2>
      <p className="text-gray-700">Here you can manage users, view stats, etc.</p>
    </DashboardLayout>
  );
}

