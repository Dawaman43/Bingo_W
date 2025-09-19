import React, { useState, useEffect } from "react";
import ModeratorLayout from "../../components/moderator/ModeratorLayout";
import moderatorService from "../../services/moderator";

const JackpotManager = () => {
  const [jackpot, setJackpot] = useState(null);
  const [history, setHistory] = useState([]);
  const [addAmount, setAddAmount] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [exploding, setExploding] = useState(false);

  // Explode jackpot modal state
  const [showExplodeModal, setShowExplodeModal] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState("");
  const [explodeCardId, setExplodeCardId] = useState("");
  const [explodeMessage, setExplodeMessage] = useState("");
  const [selectedWinnerCard, setSelectedWinnerCard] = useState(null);

  // Fetch jackpot and history on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const jackpotData = await moderatorService.getJackpot();
        setJackpot(jackpotData);
        setEnabled(jackpotData.enabled);

        const historyData = await moderatorService.getJackpotHistory();
        setHistory(historyData);
      } catch (err) {
        setError("Failed to load jackpot data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Add amount to current jackpot
  const handleAddAmount = async () => {
    if (!addAmount || isNaN(addAmount) || parseFloat(addAmount) <= 0) {
      setError("Please enter a valid positive amount to add.");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      const amountToAdd = parseFloat(addAmount);
      const result = await moderatorService.setJackpotAmount(
        jackpot.amount + amountToAdd
      );

      setJackpot({
        ...jackpot,
        amount: result.newAmount,
        baseAmount: result.newAmount,
      });

      setAddAmount("");
      setSuccess(
        `Added ${amountToAdd.toLocaleString()} BIRR to jackpot! New total: ${result.newAmount.toLocaleString()} BIRR`
      );

      // Refresh history
      const historyData = await moderatorService.getJackpotHistory();
      setHistory(historyData);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to add amount to jackpot."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Toggle jackpot enabled/disabled
  const handleToggleJackpot = async () => {
    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      const newEnabled = !enabled;
      const result = await moderatorService.toggleJackpot(newEnabled);

      setEnabled(newEnabled);
      setJackpot({
        ...jackpot,
        enabled: newEnabled,
      });

      setSuccess(
        `Jackpot ${newEnabled ? "enabled" : "disabled"} successfully!`
      );

      // Refresh history
      const historyData = await moderatorService.getJackpotHistory();
      setHistory(historyData);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to toggle jackpot."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Open explode jackpot modal
  const handleOpenExplodeModal = () => {
    setExplodeAmount("");
    setExplodeCardId("");
    setExplodeMessage("");
    setSelectedWinnerCard(null);
    setShowExplodeModal(true);
  };

  // Close explode jackpot modal
  const handleCloseExplodeModal = () => {
    setShowExplodeModal(false);
  };

  // Handle card selection for explode
  const handleCardSelect = (cardId) => {
    setExplodeCardId(cardId.toString());
    setSelectedWinnerCard({ id: cardId, number: cardId });
  };

  // Calculate remaining amount
  const getRemainingAmount = () => {
    const explodeAmt = parseFloat(explodeAmount) || 0;
    return Math.max(0, (jackpot?.amount || 0) - explodeAmt);
  };

  // Explode jackpot
  const handleExplodeJackpot = async () => {
    const amountToExplode = parseFloat(explodeAmount);
    const cardId = parseInt(explodeCardId);

    if (!amountToExplode || amountToExplode <= 0) {
      setError("Please enter a valid positive amount to explode.");
      return;
    }

    if (!cardId || isNaN(cardId)) {
      setError("Please select a valid card to win the jackpot.");
      return;
    }

    if (amountToExplode > jackpot.amount) {
      setError("Explode amount cannot exceed current jackpot amount.");
      return;
    }

    if (!explodeMessage.trim()) {
      setError("Please enter a message for the winner.");
      return;
    }

    try {
      setExploding(true);
      setError("");

      // Award the jackpot to the selected card
      const result = await moderatorService.awardJackpot(
        null, // gameId can be null for manual explode
        cardId,
        amountToExplode,
        explodeMessage
      );

      // Update jackpot to remaining amount
      const remainingAmount = getRemainingAmount();
      if (remainingAmount > 0) {
        await moderatorService.setJackpotAmount(remainingAmount);
      }

      // Refresh data
      const updatedJackpot = await moderatorService.getJackpot();
      setJackpot(updatedJackpot);
      setEnabled(updatedJackpot.enabled);

      // Refresh history
      const historyData = await moderatorService.getJackpotHistory();
      setHistory(historyData);

      setSuccess(
        `🎉 JACKPOT EXPLODED! Awarded ${amountToExplode.toLocaleString()} BIRR to Card #${cardId}!\n\n💬 Message: "${explodeMessage}"\n💰 Remaining: ${remainingAmount.toLocaleString()} BIRR`
      );

      // Close modal
      setShowExplodeModal(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to explode jackpot. Please check the details and try again."
      );
    } finally {
      setExploding(false);
    }
  };

  // Refresh jackpot data
  const handleRefresh = async () => {
    try {
      setLoading(true);
      const jackpotData = await moderatorService.getJackpot();
      setJackpot(jackpotData);
      setEnabled(jackpotData.enabled);

      const historyData = await moderatorService.getJackpotHistory();
      setHistory(historyData);

      setSuccess("Data refreshed successfully!");
    } catch (err) {
      setError("Failed to refresh data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModeratorLayout>
      <div className="container mx-auto p-6 space-y-8 max-w-4xl">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Jackpot Manager
          </h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading...</p>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md animate-pulse">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow-md animate-pulse">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {success}
            </div>
          </div>
        )}

        {/* Jackpot Control Panel */}
        {jackpot && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Jackpot Info */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <span className="mr-2">💰</span>
                Current Jackpot
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    Amount:
                  </span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {jackpot.amount.toLocaleString()} BIRR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    Base Amount:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    {jackpot.baseAmount.toLocaleString()} BIRR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    Status:
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-sm font-medium ${
                      enabled
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Last Updated:
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {new Date(jackpot.lastUpdated).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Jackpot Controls */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <span className="mr-2">⚙️</span>
                Jackpot Controls
              </h3>

              {/* Add Amount */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add to Jackpot
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="Enter amount to add"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-0"
                    disabled={updating}
                    min="0.01"
                    step="0.01"
                  />
                  <button
                    onClick={handleAddAmount}
                    disabled={
                      updating || !addAmount || parseFloat(addAmount) <= 0
                    }
                    className={`px-4 py-3 rounded-lg text-white font-medium transition-all duration-200 ${
                      updating || !addAmount || parseFloat(addAmount) <= 0
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {updating ? "Adding..." : "Add Amount"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Current: {jackpot.amount.toLocaleString()} BIRR
                  {addAmount && parseFloat(addAmount) > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {" "}
                      → New Total:{" "}
                      {(
                        jackpot.amount + parseFloat(addAmount)
                      ).toLocaleString()}{" "}
                      BIRR
                    </span>
                  )}
                </p>
              </div>

              {/* Toggle Status */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jackpot Status
                </label>
                <button
                  onClick={handleToggleJackpot}
                  disabled={updating}
                  className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                    updating
                      ? "bg-gray-400 cursor-not-allowed"
                      : enabled
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {updating
                    ? "Updating..."
                    : enabled
                    ? "Disable Jackpot"
                    : "Enable Jackpot"}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {enabled
                    ? "Jackpot is currently active and accepting contributions"
                    : "Jackpot is disabled - no contributions will be added"}
                </p>
              </div>

              {/* Explode Jackpot Button */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Explode Jackpot
                </label>
                <button
                  onClick={handleOpenExplodeModal}
                  disabled={exploding || jackpot.amount === 0 || !enabled}
                  className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                    exploding || jackpot.amount === 0 || !enabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  }`}
                >
                  {exploding
                    ? "Exploding..."
                    : `💥 Explode Jackpot (${jackpot.amount.toLocaleString()} BIRR)`}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {jackpot.amount > 0 && enabled
                    ? `Award jackpot amount to a winner (opens configuration modal)`
                    : jackpot.amount === 0
                    ? "No jackpot amount available to explode"
                    : "Jackpot must be enabled to explode"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Recent Transactions
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No jackpot transactions yet.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Transactions will appear here when jackpot amounts change.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Game
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {history.slice(0, 10).map((transaction, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.amount > 0
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : transaction.amount < 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          }`}
                        >
                          {transaction.amount > 0 ? "+" : ""}
                          {transaction.amount} BIRR
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.isManual && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                            Manual Add
                          </span>
                        )}
                        {transaction.isContribution && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                            Game Contribution
                          </span>
                        )}
                        {transaction.isAward && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                            Jackpot Award
                          </span>
                        )}
                        {!transaction.isManual &&
                          !transaction.isContribution &&
                          !transaction.isAward && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                              Status Change
                            </span>
                          )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {transaction.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.game ? (
                          <div>
                            <div className="font-medium">
                              #{transaction.game.gameNumber}
                            </div>
                            <div className="text-xs">
                              {transaction.game.status}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            N/A
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {history.length > 10 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing 10 of {history.length} transactions
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {jackpot && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {jackpot.amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Current Amount (BIRR)
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {history.filter((h) => h.amount > 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total Contributions
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {history.filter((h) => h.amount < 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total Awards
              </div>
            </div>
          </div>
        )}

        {/* Explode Jackpot Modal */}
        {showExplodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <span className="mr-2">💥</span>
                  Explode Jackpot
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure the jackpot explosion
                </p>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                {/* Current Jackpot Display */}
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Current Jackpot
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {jackpot.amount.toLocaleString()} BIRR
                  </p>
                </div>

                {/* Amount to Explode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount to Explode
                  </label>
                  <input
                    type="number"
                    value={explodeAmount}
                    onChange={(e) => setExplodeAmount(e.target.value)}
                    placeholder="Enter amount (max: current jackpot)"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={exploding}
                    min="0.01"
                    max={jackpot.amount}
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Remaining:{" "}
                    <span className="font-medium">
                      {getRemainingAmount().toLocaleString()} BIRR
                    </span>
                  </p>
                </div>

                {/* Winner Card Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Card
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={explodeCardId}
                      onChange={(e) => {
                        setExplodeCardId(e.target.value);
                        if (e.target.value) {
                          setSelectedWinnerCard({
                            id: parseInt(e.target.value),
                            number: parseInt(e.target.value),
                          });
                        } else {
                          setSelectedWinnerCard(null);
                        }
                      }}
                      placeholder="Enter card number (1-100)"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pr-24"
                      disabled={exploding}
                      min="1"
                      max="100"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  {selectedWinnerCard && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      Selected: Card #{selectedWinnerCard.number}
                    </p>
                  )}
                </div>

                {/* Winner Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Message
                  </label>
                  <textarea
                    value={explodeMessage}
                    onChange={(e) => setExplodeMessage(e.target.value)}
                    placeholder="Enter message for the winner (e.g., 'Congratulations on your big win!')"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows="3"
                    disabled={exploding}
                    maxLength="200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {explodeMessage.length}/200 characters
                  </p>
                </div>

                {/* Summary */}
                {explodeAmount && explodeCardId && explodeMessage.trim() && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Explosion Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Amount to Award:
                      </div>
                      <div className="font-semibold text-right">
                        {explodeAmount
                          ? `${parseFloat(explodeAmount).toLocaleString()} BIRR`
                          : "0 BIRR"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Winner Card:
                      </div>
                      <div className="font-semibold text-right">
                        {explodeCardId ? `#${explodeCardId}` : "Not selected"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Remaining:
                      </div>
                      <div className="font-semibold text-right text-green-600 dark:text-green-400">
                        {getRemainingAmount().toLocaleString()} BIRR
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex space-x-3 justify-end">
                <button
                  onClick={handleCloseExplodeModal}
                  disabled={exploding}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExplodeJackpot}
                  disabled={
                    exploding ||
                    !explodeAmount ||
                    !explodeCardId ||
                    !explodeMessage.trim() ||
                    parseFloat(explodeAmount) <= 0
                  }
                  className={`px-6 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                    exploding ||
                    !explodeAmount ||
                    !explodeCardId ||
                    !explodeMessage.trim() ||
                    parseFloat(explodeAmount) <= 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  }`}
                >
                  {exploding ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Exploding...
                    </span>
                  ) : (
                    "💥 Explode Jackpot"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModeratorLayout>
  );
};

export default JackpotManager;
