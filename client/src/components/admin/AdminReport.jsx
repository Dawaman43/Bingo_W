// src/components/AdminReport.js
import React, { useState, useEffect } from "react";
import {
  getAllCashiers,
  getCashierPerformance,
  getCashierReport,
  formatCashierData,
  getActiveCashiers,
} from "../api/admin"; // Updated import
import API from "../api/axios";

const AdminReport = () => {
  const [cashiers, setCashiers] = useState([]);
  const [activeCashiers, setActiveCashiers] = useState([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [selectedCashierData, setSelectedCashierData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all cashiers and active cashiers on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch all cashiers
        const allCashiersResponse = await getAllCashiers();
        setCashiers(allCashiersResponse.cashiers || []);

        // Fetch active cashiers with metrics
        const activeResponse = await getActiveCashiers();
        setActiveCashiers(activeResponse.activeCashiers || []);

        console.log("[AdminReport] Loaded cashiers:", allCashiersResponse);
      } catch (err) {
        console.error("[AdminReport] Initial load error:", err);
        setError(
          "Failed to load cashiers: " +
            (err.message || err.response?.data?.message)
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch detailed report when cashier is selected
  useEffect(() => {
    if (!selectedCashierId) {
      setSelectedCashierData(null);
      return;
    }

    const fetchCashierReport = async () => {
      setReportLoading(true);
      setError(null);
      try {
        console.log(
          "[AdminReport] Fetching report for cashier:",
          selectedCashierId
        );

        // Fetch both performance summary and detailed report
        const [performance, detailedReport] = await Promise.all([
          getCashierPerformance(selectedCashierId),
          getCashierReport(selectedCashierId),
        ]);

        // Combine the data
        const combinedData = {
          ...performance,
          detailedReport,
          formatted: formatCashierData(
            performance.cashier,
            performance.summary
          ),
        };

        setSelectedCashierData(combinedData);
        console.log("[AdminReport] Report loaded:", combinedData);
      } catch (err) {
        console.error("[AdminReport] Report fetch error:", err);
        setError(
          "Failed to fetch report: " +
            (err.message || err.response?.data?.message)
        );
      } finally {
        setReportLoading(false);
      }
    };

    fetchCashierReport();
  }, [selectedCashierId]);

  // Handle cashier selection
  const handleCashierSelect = (cashierId) => {
    setSelectedCashierId(cashierId);
    if (!cashierId) {
      setSelectedCashierData(null);
      setError(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="admin-report-container p-6 bg-gray-100 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading cashiers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-report-container p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            Admin Cashier Reports
          </h1>
          <p className="text-gray-600">
            Monitor performance and generate detailed reports for all cashiers
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-800 hover:text-red-900"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Cashiers
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {cashiers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Cashiers
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeCashiers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  $
                  {activeCashiers
                    .reduce((sum, c) => sum + (c.totalRevenue || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cashier Selection Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Select Cashier
              </h2>

              {/* Search and Filter */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search cashiers..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  // Add search functionality here
                />
              </div>

              {/* Cashier Selection Dropdown */}
              <select
                value={selectedCashierId}
                onChange={(e) => handleCashierSelect(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                disabled={reportLoading}
              >
                <option value="">-- Select a Cashier --</option>
                {cashiers.map((cashier) => (
                  <option key={cashier._id} value={cashier._id}>
                    {cashier.name} ({cashier.email})
                  </option>
                ))}
              </select>

              {/* Quick Stats for Selected Cashier */}
              {selectedCashierData && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded">
                    <p className="text-sm font-medium text-blue-800">
                      Games Played
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      {selectedCashierData.summary?.totalGames || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800">
                      Total Revenue
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      $
                      {(
                        selectedCashierData.summary?.totalPrizePool || 0
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded ${
                      (selectedCashierData.summary?.profit || 0) >= 0
                        ? "bg-purple-50"
                        : "bg-red-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-purple-800">
                      Profit
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        (selectedCashierData.summary?.profit || 0) >= 0
                          ? "text-purple-600"
                          : "text-red-600"
                      }`}
                    >
                      $
                      {selectedCashierData.summary?.profit?.toFixed(2) ||
                        "0.00"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Active Cashiers List */}
            <div className="bg-white p-6 rounded-lg shadow mt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Active Cashiers
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activeCashiers.slice(0, 5).map((cashier) => (
                  <div
                    key={cashier.id}
                    className={`p-3 rounded cursor-pointer hover:bg-gray-50 border-l-4 ${
                      selectedCashierId === cashier.id
                        ? "bg-blue-50 border-blue-500"
                        : "border-transparent"
                    }`}
                    onClick={() => handleCashierSelect(cashier.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">
                          {cashier.name}
                        </p>
                        <p className="text-sm text-gray-500">{cashier.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {cashier.totalGames} games
                        </p>
                        <p
                          className={`text-xs ${
                            cashier.totalProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          ${cashier.totalProfit?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {activeCashiers.length > 5 && (
                <button className="mt-3 text-blue-600 hover:text-blue-800 text-sm">
                  View All Active ({activeCashiers.length})
                </button>
              )}
            </div>
          </div>

          {/* Report Details Panel */}
          <div className="lg:col-span-2">
            {reportLoading && (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <div className="flex justify-center items-center space-x-2 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Loading report...</span>
                </div>
              </div>
            )}

            {!selectedCashierId && !reportLoading && (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                <div className="max-w-md mx-auto">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium mb-2">
                    No Cashier Selected
                  </h3>
                  <p className="mb-4">
                    Please select a cashier from the dropdown or list to view
                    their detailed report.
                  </p>
                </div>
              </div>
            )}

            {selectedCashierData && (
              <div className="space-y-6">
                {/* Cashier Header */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedCashierData.cashier.name}
                      </h2>
                      <p className="text-gray-600 mt-1">
                        {selectedCashierData.cashier.email}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Member since:{" "}
                        {new Date(
                          selectedCashierData.cashier.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="mt-4 md:mt-0">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          selectedCashierData.performance?.totalGames > 0
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {selectedCashierData.performance?.totalGames > 0
                          ? "Active"
                          : "New"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold mb-6 text-gray-800">
                    Performance Overview
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center p-4">
                      <p className="text-sm font-medium text-gray-600">
                        Total Games
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {selectedCashierData.summary.totalGames}
                      </p>
                    </div>
                    <div className="text-center p-4">
                      <p className="text-sm font-medium text-gray-600">
                        Prize Pool
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        $
                        {selectedCashierData.summary.totalPrizePool.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4">
                      <p className="text-sm font-medium text-gray-600">
                        Win Rate
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        {selectedCashierData.summary.winRate}%
                      </p>
                    </div>
                    <div className="text-center p-4">
                      <p className="text-sm font-medium text-gray-600">
                        Profit
                      </p>
                      <p
                        className={`text-3xl font-bold ${
                          selectedCashierData.summary.profit >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        ${selectedCashierData.summary.profit.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Games Table */}
                {selectedCashierData.recentGames &&
                  selectedCashierData.recentGames.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-xl font-semibold mb-4 text-gray-800">
                        Recent Games
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Game #
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pattern
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Bet Amount
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                House Fee
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Prize
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedCashierData.recentGames.map((game) => (
                              <tr key={game._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  #{game.gameNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      game.status === "completed"
                                        ? "bg-green-100 text-green-800"
                                        : game.status === "active"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                                  >
                                    {game.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {game.pattern}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ${game.betAmount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ${game.houseFee?.toFixed(2) || "0.00"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ${game.winner?.prize?.toFixed(2) || "0.00"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(
                                    game.createdAt
                                  ).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedCashierData.recentGames.length <
                        selectedCashierData.summary.totalGames && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500">
                            Showing {selectedCashierData.recentGames.length} of{" "}
                            {selectedCashierData.summary.totalGames} games
                          </p>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReport;
