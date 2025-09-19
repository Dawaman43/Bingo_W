import React, { useEffect, useState } from "react";
import DashboardLayout from "../../components/admin/DashboardLayout";
import { getUsers, deleteUser } from "../../services/admin";
import { Users, Trash2, User, Users2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    pairId: null,
  });

  // Load users and group into pairs
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        const users = data.users || [];

        // Group cashiers with their moderators
        const groupedPairs = [];
        const processedIds = new Set();

        users.forEach((user) => {
          if (user.role === "cashier" && !processedIds.has(user._id)) {
            const moderator = users.find((u) => u.managedCashier === user._id);
            if (moderator) {
              processedIds.add(user._id);
              processedIds.add(moderator._id);
              groupedPairs.push({
                id: user._id, // Use cashier ID as pair ID for deletion
                cashier: user,
                moderator: moderator,
              });
            }
          }
        });

        // Add standalone moderators if any
        users.forEach((user) => {
          if (user.role === "moderator" && !processedIds.has(user._id)) {
            groupedPairs.push({
              id: user._id,
              cashier: null,
              moderator: user,
            });
          }
        });

        setPairs(groupedPairs);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Delete pair
  const handleDelete = async () => {
    try {
      await deleteUser(confirmDelete.pairId);
      setPairs(pairs.filter((p) => p.id !== confirmDelete.pairId));
      toast.success("User pair deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete user pair");
    } finally {
      setConfirmDelete({ open: false, pairId: null });
    }
  };

  // Count stats
  const pairCount = pairs.length;
  const totalUsers = pairs.reduce((acc, pair) => {
    acc += pair.cashier ? 1 : 0;
    acc += pair.moderator ? 1 : 0;
    return acc;
  }, 0);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {/* Header */}
        <div className="mb-8 px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-400 flex items-center gap-2">
            <Users size={28} className="text-blue-300" />
            Admin Dashboard
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Manage cashier-moderator pairs efficiently
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 mb-8">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-4 sm:p-6 rounded-xl shadow-xl border border-blue-500/20 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg">
                <Users size={24} className="text-blue-300" />
              </div>
              <div>
                <p className="text-blue-200 text-xs sm:text-sm font-medium uppercase">
                  Active Pairs
                </p>
                <p className="text-white text-xl sm:text-2xl font-bold">
                  {pairCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-900 to-green-800 p-4 sm:p-6 rounded-xl shadow-xl border border-green-500/20 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
                <Users2 size={24} className="text-green-300" />
              </div>
              <div>
                <p className="text-green-200 text-xs sm:text-sm font-medium uppercase">
                  Total Users
                </p>
                <p className="text-white text-xl sm:text-2xl font-bold">
                  {totalUsers}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 p-4 sm:p-6 rounded-xl shadow-xl border border-purple-500/20 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg">
                <User size={24} className="text-purple-300" />
              </div>
              <div>
                <p className="text-purple-200 text-xs sm:text-sm font-medium uppercase">
                  Linked Pairs
                </p>
                <p className="text-white text-xl sm:text-2xl font-bold">
                  {pairCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Pairs Table */}
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 rounded-2xl shadow-2xl border border-gray-700/30">
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-blue-400 flex items-center gap-2">
              <Users2 size={24} className="text-blue-300" />
              User Pairs
            </h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-400 animate-pulse text-sm sm:text-base">
                  Loading user pairs...
                </div>
              </div>
            ) : pairs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={40} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No user pairs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-800/50 backdrop-blur-sm text-gray-300 text-xs sm:text-sm">
                    <tr>
                      <th className="p-3 sm:p-4 font-semibold rounded-tl-lg">
                        Cashier
                      </th>
                      <th className="p-3 sm:p-4 font-semibold">Moderator</th>
                      <th className="p-3 sm:p-4 font-semibold hidden md:table-cell">
                        Emails
                      </th>
                      <th className="p-3 sm:p-4 font-semibold text-center rounded-tr-lg">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((pair) => (
                      <tr
                        key={pair.id}
                        className="border-t border-gray-700/30 hover:bg-gray-800/30 transition-all duration-200"
                      >
                        <td className="p-3 sm:p-4">
                          {pair.cashier ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <User size={16} className="text-blue-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm sm:text-base font-medium">
                                  {pair.cashier.name}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-400 capitalize">
                                  Cashier
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm italic">
                              No Cashier
                            </p>
                          )}
                        </td>
                        <td className="p-3 sm:p-4">
                          {pair.moderator ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                <User size={16} className="text-green-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm sm:text-base font-medium">
                                  {pair.moderator.name}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-400 capitalize">
                                  Moderator
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm italic">
                              No Moderator
                            </p>
                          )}
                        </td>
                        <td className="p-3 sm:p-4 hidden md:table-cell">
                          <div className="space-y-1">
                            {pair.cashier && (
                              <p className="text-xs sm:text-sm text-amber-50 truncate max-w-xs">
                                {pair.cashier.email}
                              </p>
                            )}
                            {pair.moderator && (
                              <p className="text-xs sm:text-sm text-amber-50 truncate max-w-xs">
                                {pair.moderator.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 sm:p-4 text-center">
                          <button
                            onClick={() =>
                              setConfirmDelete({ open: true, pairId: pair.id })
                            }
                            className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg transition-all duration-200 border border-red-500/30 text-sm"
                            title="Delete Pair"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmDelete.open && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md text-white border border-gray-700/30">
              <h4 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
                <Trash2 size={20} />
                Confirm Pair Deletion
              </h4>
              <p className="mb-6 text-sm sm:text-base text-gray-300">
                Are you sure you want to delete this user pair? This action
                cannot be undone and will remove both the cashier and moderator.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() =>
                    setConfirmDelete({ open: false, pairId: null })
                  }
                  className="px-4 sm:px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer font-medium text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 sm:px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Trash2 size={16} />
                  Delete Pair
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
