import API from "./axios";

const reportService = {
  /**
   * Fetches report data with optional filters.
   * @param {Object} filters - Filter object: { status, pattern, startDate, endDate }
   * @returns {Promise<Object>} Report data including stats and games list
   */
  getReport: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await API.get("/games/report", { params });
      console.log("reportService.getReport response:", response);
      return response.data.data; // { totalGames, activeGames, totalHouseFee, games }
    } catch (error) {
      console.error(
        "reportService.getReport error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * Fetches aggregated stats only (optimized for quick stats update).
   * @param {Object} filters - Same as getReport
   * @returns {Promise<Object>} Just the stats: { totalGames, activeGames, totalHouseFee }
   */
  getStats: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await API.get("/games/stats", { params }); // Optional: Add a separate /stats route if needed for optimization
      console.log("reportService.getStats response:", response);
      return response.data.data;
    } catch (error) {
      console.error(
        "reportService.getStats error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};

export default reportService;
