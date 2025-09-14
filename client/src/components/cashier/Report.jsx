import React, { useState, useEffect } from "react";
import reportService from "../../services/report";
import gameService from "../../services/game";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler,
} from "chart.js";
import { Pie, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler
);

const CashierReport = () => {
  const [reportData, setReportData] = useState({
    totalGames: 0,
    activeGames: 0,
    totalHouseFee: "0.00",
    games: [],
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    pattern: "",
    startDate: "",
    endDate: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentJackpot, setCurrentJackpot] = useState(0);

  // Enhanced chart data states
  const [gamesStatusData, setGamesStatusData] = useState({
    labels: ["Active/Pending", "Finished"],
    datasets: [{ data: [0, 0] }],
  });
  const [patternsData, setPatternsData] = useState({
    labels: ["Line", "Diagonal", "X Pattern"],
    datasets: [{ data: [0, 0, 0] }],
  });
  const [dailyActivityData, setDailyActivityData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
  });
  const [betAmountData, setBetAmountData] = useState({
    labels: [
      "0-10 Birr",
      "11-20 Birr",
      "21-50 Birr",
      "51-100 Birr",
      "100+ Birr",
    ],
    datasets: [{ data: [0, 0, 0, 0, 0] }],
  });
  // New charts
  const [houseFeeData, setHouseFeeData] = useState({
    labels: ["Low (<10%)", "Medium (10-20%)", "High (>20%)"],
    datasets: [{ data: [0, 0, 0] }],
  });
  const [revenueTrendData, setRevenueTrendData] = useState({
    labels: [], // Will be populated with dates
    datasets: [{ data: [] }],
  });
  const [jackpotContributionData, setJackpotContributionData] = useState({
    labels: ["This Week", "Last Week", "Prior"],
    datasets: [{ data: [0, 0, 0] }],
  });

  // Enhanced summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalGames: 0,
    activeGames: 0,
    completedGames: 0,
    totalHouseFee: 0,
    sumBetAmounts: 0,
    totalPrizePool: 0,
    averageBetAmount: 0,
    totalPotentialJackpot: 0,
  });

  useEffect(() => {
    fetchReportData();
  }, [filters]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const data = await reportService.getReport(filters);
      console.log("Report data:", data);
      setReportData(data);
      updateSummaryStats(data);
      updateCharts(data.games);
      // Fetch current jackpot
      const jackpotData = await gameService.getJackpot();
      setCurrentJackpot(jackpotData.amount || 0);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSummaryStats = (data) => {
    const games = data.games || [];
    const sumBet = games.reduce(
      (sum, g) => sum + parseFloat(g.bet_amount || 0),
      0
    );
    const totalPrize = games.reduce(
      (sum, g) => sum + parseFloat(g.prize_pool || 0),
      0
    );
    const completed = games.filter((g) => g.status === "finished").length;
    const avgBet = games.length > 0 ? (sumBet / games.length).toFixed(2) : 0;
    const totalPotential = games.reduce(
      (sum, g) => sum + parseFloat(g.potential_jackpot || 0),
      0
    );

    setSummaryStats({
      totalGames: data.totalGames,
      activeGames: data.activeGames,
      completedGames: completed,
      totalHouseFee:
        parseFloat(data.totalHouseFee) ||
        games.reduce((sum, g) => sum + parseFloat(g.house_fee || 0), 0),
      sumBetAmounts: sumBet.toFixed(2),
      totalPrizePool: totalPrize.toFixed(2),
      averageBetAmount: avgBet,
      totalPotentialJackpot: totalPotential.toFixed(2),
    });
  };

  const updateCharts = (games) => {
    // Games Status (Pie)
    const active = games.filter(
      (g) => g.status === "active" || g.status === "pending"
    ).length;
    const finished = games.filter((g) => g.status === "finished").length;
    setGamesStatusData({
      labels: ["Active/Pending", "Finished"],
      datasets: [
        {
          data: [active, finished],
          backgroundColor: ["#3B82F6", "#10B981"],
          borderColor: ["#1D4ED8", "#059669"],
          borderWidth: 1,
        },
      ],
    });

    // Patterns (Bar)
    const line = games.filter((g) => g.winning_pattern === "line").length;
    const diagonal = games.filter(
      (g) => g.winning_pattern === "diagonal"
    ).length;
    const x = games.filter((g) => g.winning_pattern === "x_pattern").length;
    setPatternsData({
      datasets: [
        {
          label: "Number of Games",
          data: [line, diagonal, x],
          backgroundColor: "#F59E0B",
          borderColor: "#D97706",
          borderWidth: 1,
        },
      ],
    });

    // Daily Activity (Line)
    const daily = [0, 0, 0, 0, 0, 0, 0];
    games.forEach((game) => {
      const date = new Date(game.started_at);
      const day = date.getDay() === 0 ? 6 : date.getDay() - 1;
      daily[day]++;
    });
    setDailyActivityData({
      datasets: [
        {
          label: "Number of Games",
          data: daily,
          borderColor: "#8B5CF6",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    });

    // Bet Amount (Bar)
    const bet = [0, 0, 0, 0, 0];
    games.forEach((game) => {
      const amount = parseFloat(game.bet_amount || 0);
      if (amount <= 10) bet[0]++;
      else if (amount <= 20) bet[1]++;
      else if (amount <= 50) bet[2]++;
      else if (amount <= 100) bet[3]++;
      else bet[4]++;
    });
    setBetAmountData({
      datasets: [
        {
          label: "Number of Games",
          data: bet,
          backgroundColor: "#10B981",
          borderColor: "#059669",
          borderWidth: 1,
        },
      ],
    });

    // House Fee Distribution (Bar)
    const houseLow = games.filter(
      (g) => parseFloat(g.house_percentage || 0) < 10
    ).length;
    const houseMed = games.filter((g) => {
      const perc = parseFloat(g.house_percentage || 0);
      return perc >= 10 && perc <= 20;
    }).length;
    const houseHigh = games.filter(
      (g) => parseFloat(g.house_percentage || 0) > 20
    ).length;
    setHouseFeeData({
      datasets: [
        {
          label: "Number of Games",
          data: [houseLow, houseMed, houseHigh],
          backgroundColor: "#EF4444",
          borderColor: "#DC2626",
          borderWidth: 1,
        },
      ],
    });

    // Revenue Trend (Line) - House Fee over last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();
    const revenueData = last7Days.map((date) => {
      return games
        .filter((g) => {
          const gDate = new Date(g.started_at).toISOString().split("T")[0];
          return gDate === date;
        })
        .reduce((sum, g) => sum + parseFloat(g.house_fee || 0), 0);
    });
    setRevenueTrendData({
      labels: last7Days.map((d) =>
        new Date(d).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      ),
      datasets: [
        {
          label: "House Fee (Birr)",
          data: revenueData,
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    });

    // New: Jackpot Contribution (Bar) - Simplified periods
    const thisWeek = games
      .filter((g) => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(g.started_at) > weekAgo;
      })
      .reduce((sum, g) => sum + parseFloat(g.potential_jackpot || 0), 0);
    const lastWeek = games
      .filter((g) => {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const gDate = new Date(g.started_at);
        return gDate > twoWeeksAgo && gDate <= weekAgo;
      })
      .reduce((sum, g) => sum + parseFloat(g.potential_jackpot || 0), 0);
    const prior =
      games.reduce((sum, g) => sum + parseFloat(g.potential_jackpot || 0), 0) -
      thisWeek -
      lastWeek;
    setJackpotContributionData({
      datasets: [
        {
          label: "Contributions (Birr)",
          data: [thisWeek, lastWeek, prior],
          backgroundColor: "#F59E0B",
          borderColor: "#D97706",
          borderWidth: 1,
        },
      ],
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredGames = reportData.games.filter(
    (game) =>
      game.gameNumber.toString().includes(searchTerm) ||
      game.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.winning_pattern.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = [
      "Game #",
      "Date",
      "Pattern",
      "Bet Amount",
      "House %",
      "House Fee",
      "Prize Pool",
      "Status",
    ];
    const csvRows = [
      headers.join(","),
      ...filteredGames.map((game) =>
        [
          game.gameNumber,
          new Date(game.started_at).toLocaleDateString(),
          game.winning_pattern.replace("_", " "),
          `${game.bet_amount} Birr`,
          `${game.house_percentage}%`,
          `${parseFloat(game.house_fee || 0).toFixed(2)} Birr`,
          `${parseFloat(game.prize_pool || 0).toFixed(2)} Birr`,
          game.status,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvRows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `games-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPatternDisplay = (pattern) => {
    if (pattern === "x_pattern") return "X Pattern";
    return pattern.charAt(0).toUpperCase() + pattern.slice(1);
  };

  const getStatusDisplay = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderTableRow = (game, index) => (
    <tr
      key={game.id}
      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
        {index + 1}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {new Date(game.started_at).toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            game.winning_pattern === "line"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              : game.winning_pattern === "diagonal"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
          }`}
        >
          {getPatternDisplay(game.winning_pattern)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {parseFloat(game.bet_amount || 0).toFixed(2)} Birr
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {game.house_percentage || 0}%
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {parseFloat(game.house_fee || 0).toFixed(2)} Birr
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {parseFloat(game.prize_pool || 0).toFixed(2)} Birr
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            game.status === "active"
              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              : game.status === "pending"
              ? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          }`}
        >
          {getStatusDisplay(game.status)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <button
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 px-2 py-1 rounded"
            onClick={() => handleGameAction("view", game.id)}
          >
            View
          </button>
          {game.status !== "finished" && (
            <>
              <button
                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 px-2 py-1 rounded"
                onClick={() => handleGameAction("edit", game.id)}
              >
                Edit
              </button>
              <button
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 px-2 py-1 rounded"
                onClick={() => handleGameAction("end", game.id)}
              >
                End
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const handleGameAction = (action, id) => {
    console.log(`Action: ${action} for game ${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      {/* Enhanced Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[
          {
            label: "Total Games",
            value: summaryStats.totalGames,
            icon: "🎲",
            color:
              "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
          },
          {
            label: "Active Games",
            value: summaryStats.activeGames,
            icon: "⏳",
            color:
              "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
          },
          {
            label: "Completed Games",
            value: summaryStats.completedGames,
            icon: "✅",
            color:
              "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
          },
          {
            label: "Total House Fee",
            value: `${summaryStats.totalHouseFee.toFixed(2)} Birr`,
            icon: "💰",
            color:
              "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200",
          },
          {
            label: "Sum Bet Amounts",
            value: `${summaryStats.sumBetAmounts} Birr`,
            icon: "📈",
            color:
              "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
          },
          {
            label: "Total Prize Pool",
            value: `${summaryStats.totalPrizePool} Birr`,
            icon: "🏆",
            color:
              "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200",
          },
          {
            label: "Avg Bet Amount",
            value: `${summaryStats.averageBetAmount} Birr`,
            icon: "📊",
            color:
              "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
          },
          {
            label: "Total Potential Jackpot",
            value: `${summaryStats.totalPotentialJackpot} Birr`,
            icon: "⭐",
            color:
              "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200",
          },
          {
            label: "Current Jackpot",
            value: `${currentJackpot.toFixed(2)} Birr`,
            icon: "💎",
            color:
              "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
          },
        ].map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 text-center transition-all hover:scale-105"
          >
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-2 ${stat.color}`}
            >
              <span className="text-lg">{stat.icon}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {stat.label}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters with Search and Export */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Filters & Search
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="finished">Finished</option>
          </select>
          <select
            value={filters.pattern}
            onChange={(e) => handleFilterChange("pattern", e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Patterns</option>
            <option value="line">Line</option>
            <option value="diagonal">Diagonal</option>
            <option value="x_pattern">X Pattern</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Search games..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="mt-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Export to CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Games List ({filteredGames.length} results)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Pattern
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Bet Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  House %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  House Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Prize Pool
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredGames.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No games found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredGames.map((game, index) =>
                  renderTableRow(game, index + 1)
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Games by Status
          </h3>
          <div className="h-64">
            <Pie
              data={gamesStatusData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Winning Patterns Distribution
          </h3>
          <div className="h-64">
            <Bar
              data={patternsData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Daily Activity
          </h3>
          <div className="h-64">
            <Line
              data={dailyActivityData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Bet Amount Distribution
          </h3>
          <div className="h-64">
            <Bar
              data={betAmountData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            House Fee Distribution
          </h3>
          <div className="h-64">
            <Bar
              data={houseFeeData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Revenue Trend (Last 7 Days)
          </h3>
          <div className="h-64">
            <Line
              data={revenueTrendData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Jackpot Contributions by Period
          </h3>
          <div className="h-64">
            <Bar
              data={jackpotContributionData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierReport;
