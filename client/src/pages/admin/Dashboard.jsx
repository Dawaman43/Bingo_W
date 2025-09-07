import React, { useEffect, useState } from "react";
import DashboardLayout from "../../components/admin/DashboardLayout";
import { getUsers, deleteUser } from "../../services/admin";
import { Users, Trash2, User } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, userId: null });

  // Load users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data.users || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Delete user
  const handleDelete = async () => {
    try {
      await deleteUser(confirmDelete.userId);
      setUsers(users.filter((u) => u._id !== confirmDelete.userId));
      toast.success("User deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete user");
    } finally {
      setConfirmDelete({ open: false, userId: null });
    }
  };

  // Count users by role
  const counts = users.reduce(
    (acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    },
    { cashier: 0, moderator: 0 }
  );

  const totalUsers = users.length;

  return (
    <DashboardLayout>
      <h2 className="text-3xl font-bold mb-6 text-blue-400">Admin Dashboard</h2>

      {/* User counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg flex items-center gap-3 shadow-lg">
          <Users size={32} className="text-blue-400" />
          <div>
            <p className="text-gray-400 text-sm">Cashiers</p>
            <p className="text-white text-xl font-bold">{counts.cashier}</p>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg flex items-center gap-3 shadow-lg">
          <User size={32} className="text-green-400" />
          <div>
            <p className="text-gray-400 text-sm">Moderators</p>
            <p className="text-white text-xl font-bold">{counts.moderator}</p>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg flex items-center gap-3 shadow-lg">
          <Users size={32} className="text-yellow-400" />
          <div>
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-white text-xl font-bold">{totalUsers}</p>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-xl">
        <h3 className="text-xl font-semibold mb-4 text-blue-400">Users</h3>

        {loading ? (
          <p className="text-gray-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-400">No users found.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-gray-700 hover:bg-gray-800">
                  <td className="p-3 text-amber-50">{u.name}</td>
                  <td className="p-3 text-amber-50">{u.email}</td>
                  <td className="p-3 capitalize text-amber-50">{u.role}</td>
                  <td className="p-3 text-center">
                    {u.role !== "admin" && (
                      <button
                        onClick={() => setConfirmDelete({ open: true, userId: u._id })}
                        className="text-red-500 hover:text-red-700 transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDelete.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-80 text-white">
            <h4 className="text-lg font-bold mb-4">Confirm Deletion</h4>
            <p className="mb-6">Are you sure you want to delete this user?</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setConfirmDelete({ open: false, userId: null })}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
