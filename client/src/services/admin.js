/**
 * Admin API Service
 * Handles all admin-related API calls
 */

import API from "./axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

// ----------------- User Management -----------------

// Admin can Get all users
export const getUsers = async () => {
  const res = await API.get("/admin/users", getAuthHeader());
  return res.data;
};

// Admin can Delete user by ID
export const deleteUser = async (id) => {
  const res = await API.delete(`/admin/users/${id}`, getAuthHeader());
  return res.data;
};

// Admin can Add new user (cashier + moderator pair)
export const addUser = async (data) => {
  const res = await API.post("/admin/add-user", data, getAuthHeader());
  return res.data;
};

// ----------------- Cashier Management -----------------

// Admin can Get all cashiers
export const getAllCashiers = async () => {
  const res = await API.get("/games/admin/cashiers", getAuthHeader());
  return res.data;
};

// Admin can Get cashier details by ID
export const getCashierDetails = async (cashierId) => {
  const res = await API.get(
    `/games/admin/cashier-summary/${cashierId}`,
    getAuthHeader()
  );
  return res.data;
};

// Admin can Get detailed cashier report
export const getCashierReport = async (cashierId) => {
  const res = await API.get(
    `/games/admin/cashier-report?cashierId=${cashierId}`,
    getAuthHeader()
  );
  return res.data;
};

// ----------------- Cashier Reports & Analytics -----------------

// Admin can Get cashier performance summary
export const getCashierPerformance = async (cashierId) => {
  const res = await API.get(
    `/games/admin/cashier-summary/${cashierId}`,
    getAuthHeader()
  );
  return res.data;
};

// Admin can Get multiple cashier summaries (batch)
export const getCashiersBatchSummary = async (cashierIds) => {
  // Note: This would require a backend endpoint to handle batch requests
  // For now, we'll make sequential calls
  const summaries = await Promise.all(
    cashierIds.map((id) => getCashierPerformance(id).catch((err) => null))
  );
  return summaries.filter((summary) => summary !== null);
};

// Admin can Get cashiers with performance metrics
export const getCashiersWithMetrics = async () => {
  try {
    const { cashiers } = await getAllCashiers();
    const cashierIds = cashiers.map((c) => c._id);
    const summaries = await getCashiersBatchSummary(cashierIds);

    // Merge cashier details with their performance metrics
    const cashiersWithMetrics = cashiers.map((cashier) => {
      const summary = summaries.find((s) => s.cashier.id === cashier._id);
      return {
        ...cashier,
        performance: summary?.summary || null,
        recentGames: summary?.recentGames || [],
        hasReport: !!summary,
      };
    });

    return {
      success: true,
      cashiers: cashiersWithMetrics,
      total: cashiersWithMetrics.length,
    };
  } catch (error) {
    console.error("[getCashiersWithMetrics] Error:", error);
    throw new Error(`Failed to fetch cashiers with metrics: ${error.message}`);
  }
};

// ----------------- Report Filters -----------------

// Admin can Get cashier report with date range filter
export const getCashierReportByDate = async (cashierId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const url = `/games/admin/cashier-report?cashierId=${cashierId}${
    params.toString() ? "&" + params.toString() : ""
  }`;
  const res = await API.get(url, getAuthHeader());
  return res.data;
};

// Admin can Get cashier games by status
export const getCashierGamesByStatus = async (cashierId, status = "all") => {
  const params = new URLSearchParams({ cashierId });
  if (status !== "all") params.append("status", status);

  const url = `/games/admin/cashier-games?${params.toString()}`;
  const res = await API.get(url, getAuthHeader());
  return res.data;
};

// ----------------- Administrative Actions -----------------

// Admin can Reset cashier game counter
export const resetCashierGameCounter = async (cashierId) => {
  const res = await API.post(
    `/games/admin/reset-counter/${cashierId}`,
    {},
    getAuthHeader()
  );
  return res.data;
};

// Admin can Get system-wide statistics
export const getSystemStatistics = async () => {
  const res = await API.get("/admin/system-stats", getAuthHeader());
  return res.data;
};

// Admin can Get all games across all cashiers
export const getAllGamesAdmin = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key]) params.append(key, filters[key]);
  });

  const url = `/admin/games${params.toString() ? "?" + params.toString() : ""}`;
  const res = await API.get(url, getAuthHeader());
  return res.data;
};

// ----------------- Utility Functions -----------------

// Helper function to validate cashier ID
export const validateCashierId = (cashierId) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(cashierId);
};

// Helper function to format cashier data for display
export const formatCashierData = (cashier, performance = null) => {
  if (!cashier) return null;

  return {
    id: cashier._id,
    name: cashier.name || "Unknown Cashier",
    email: cashier.email || "No email",
    role: cashier.role || "cashier",
    createdAt: cashier.createdAt
      ? new Date(cashier.createdAt).toLocaleDateString()
      : "Unknown",
    totalGames: performance?.totalGames || 0,
    totalRevenue: performance?.totalPrizePool || 0,
    totalProfit: performance?.profit || 0,
    winRate: performance?.winRate || 0,
    status: performance && performance.totalGames > 0 ? "Active" : "New",
    recentGamesCount: performance?.recentGames?.length || 0,
  };
};

// Helper function to get cashier performance overview
export const getCashierOverview = async (cashierId) => {
  try {
    const [details, report] = await Promise.all([
      getCashierDetails(cashierId),
      getCashierReport(cashierId),
    ]);

    return {
      success: true,
      cashier: details.cashier,
      performance: details.summary,
      detailedReport: report,
      games: details.recentGames || [],
      counters: report.counters || [],
      results: report.results || [],
    };
  } catch (error) {
    console.error("[getCashierOverview] Error:", error);
    throw new Error(`Failed to get cashier overview: ${error.message}`);
  }
};

// ----------------- Bulk Operations -----------------

// Admin can Get all active cashiers with basic stats
export const getActiveCashiers = async () => {
  try {
    const { cashiers } = await getAllCashiers();
    const activeCashierIds = cashiers
      .filter(
        (c) =>
          new Date(c.createdAt) <
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ) // Active for 30+ days
      .map((c) => c._id);

    const summaries = await getCashiersBatchSummary(
      activeCashierIds.slice(0, 10)
    ); // Limit to 10 for performance

    const activeCashiers = cashiers
      .filter((c) => activeCashierIds.includes(c._id))
      .map((cashier) => {
        const summary = summaries.find((s) => s.cashier.id === cashier._id);
        return formatCashierData(cashier, summary?.summary);
      });

    return {
      success: true,
      activeCashiers,
      totalActive: activeCashiers.length,
      totalAll: cashiers.length,
    };
  } catch (error) {
    console.error("[getActiveCashiers] Error:", error);
    throw new Error(`Failed to get active cashiers: ${error.message}`);
  }
};

// Add this to your admin service file (services/admin.js)
export const getAllCashierSummaries = async () => {
  try {
    const response = await API.get("/games/admin/all-cashier-summaries");
    return response.data;
  } catch (error) {
    console.error("[getAllCashierSummaries] API Error:", error);
    throw error;
  }
};
// Export all functions for easy import
export default {
  // User Management
  getUsers,
  deleteUser,
  addUser,

  // Cashier Management
  getAllCashiers,
  getCashierDetails,
  getCashierReport,

  // Reports & Analytics
  getCashierPerformance,
  getCashiersBatchSummary,
  getCashiersWithMetrics,
  getCashierReportByDate,
  getCashierGamesByStatus,

  // Administrative Actions
  resetCashierGameCounter,
  getSystemStatistics,
  getAllGamesAdmin,

  // Utilities
  validateCashierId,
  formatCashierData,
  getCashierOverview,

  // Bulk Operations
  getActiveCashiers,
};
