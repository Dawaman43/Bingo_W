import React, { useState, useEffect } from "react";
import ModeratorLayout from "../../components/moderator/ModeratorLayout";
import moderatorService from "../../services/moderator";

const JackpotManager = () => {
  const [jackpot, setJackpot] = useState(null);
  const [history, setHistory] = useState([]);
  const [addAmount, setAddAmount] = useState("");
  const [addGameId, setAddGameId] = useState(""); // New state for gameId in add amount
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [awarding, setAwarding] = useState(false);

  // Award jackpot modal state
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardAmount, setAwardAmount] = useState("");
  const [awardCardId, setAwardCardId] = useState("");
  const [awardMessage, setAwardMessage] = useState("");
  const [awardGameId, setAwardGameId] = useState(""); // New state for gameId in award modal
  const [selectedWinnerCard, setSelectedWinnerCard] = useState(null);

  // Edit award modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLogId, setEditLogId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCardId, setEditCardId] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editGameId, setEditGameId] = useState(""); // New state for gameId in edit modal
  const [editSelectedWinnerCard, setEditSelectedWinnerCard] = useState(null);

  // Fetch jackpot and award history with retry mechanism
  const fetchData = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError("");
      const jackpotData = await moderatorService.getJackpot();
      console.log("[JackpotManager] Fetched jackpot:", jackpotData);
      setJackpot(jackpotData);
      setEnabled(jackpotData.enabled);
      if (jackpotData.winnerCardId) {
        setAwardCardId(jackpotData.winnerCardId);
        setSelectedWinnerCard({
          id: parseInt(jackpotData.winnerCardId),
          number: parseInt(jackpotData.winnerCardId),
        });
      } else {
        setAwardCardId("");
        setSelectedWinnerCard(null);
      }

      const historyData = await moderatorService.getJackpotHistory();
      console.log("[JackpotManager] Fetched history:", historyData);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error("[JackpotManager] Fetch error:", err);
      if (retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), 1000);
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load jackpot data. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add amount to current jackpot
  const handleAddAmount = async () => {
    const amountToAdd = parseFloat(addAmount);
    const gameId = addGameId ? parseInt(addGameId) : undefined;

    if (!addAmount || isNaN(amountToAdd) || amountToAdd <= 0) {
      setError("Please enter a valid positive amount to add.");
      return;
    }

    if (gameId !== undefined && (isNaN(gameId) || gameId < 1)) {
      setError("Please enter a valid game number (1 or higher).");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      setSuccess("");
      const result = await moderatorService.setJackpotAmount(
        jackpot.amount + amountToAdd,
        gameId
      );
      console.log("[JackpotManager] Add amount result:", result);
      setJackpot({
        ...jackpot,
        amount: result.newAmount,
        baseAmount: result.newAmount,
      });
      setAddAmount("");
      setAddGameId(""); // Clear gameId input
      setSuccess(
        `Added ${amountToAdd.toLocaleString()} BIRR to jackpot!${
          gameId !== undefined ? ` (Game #${gameId})` : ""
        } New total: ${result.newAmount.toLocaleString()} BIRR`
      );
      setTimeout(fetchData, 500); // Refresh history
    } catch (err) {
      console.error("[JackpotManager] Add amount error:", err);
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
      console.log("[JackpotManager] Toggle jackpot result:", result);
      setEnabled(newEnabled);
      setJackpot({ ...jackpot, enabled: newEnabled });
      setSuccess(
        `Jackpot ${newEnabled ? "enabled" : "disabled"} successfully!`
      );
      setTimeout(fetchData, 500); // Refresh history
    } catch (err) {
      console.error("[JackpotManager] Toggle jackpot error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to toggle jackpot."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Open award jackpot modal
  const handleOpenAwardModal = () => {
    setAwardAmount("");
    setAwardMessage("");
    setAwardGameId(""); // Clear gameId input
    if (jackpot.winnerCardId) {
      setAwardCardId(jackpot.winnerCardId);
      setSelectedWinnerCard({
        id: parseInt(jackpot.winnerCardId),
        number: parseInt(jackpot.winnerCardId),
      });
    } else {
      setAwardCardId("");
      setSelectedWinnerCard(null);
    }
    setShowAwardModal(true);
  };

  // Close award jackpot modal
  const handleCloseAwardModal = () => {
    setShowAwardModal(false);
    setAwardAmount("");
    setAwardCardId("");
    setAwardMessage("");
    setAwardGameId(""); // Clear gameId input
    setSelectedWinnerCard(null);
  };

  // Open edit award modal
  const handleOpenEditModal = (log) => {
    setEditLogId(log._id);
    setEditAmount(-log.amount);
    setEditCardId(log.winnerCardId);
    setEditMessage(log.message);
    setEditGameId(log.game?.gameNumber || ""); // Set gameId from history
    setEditSelectedWinnerCard({
      id: parseInt(log.winnerCardId),
      number: parseInt(log.winnerCardId),
    });
    setShowEditModal(true);
  };

  // Close edit award modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditLogId(null);
    setEditAmount("");
    setEditCardId("");
    setEditMessage("");
    setEditGameId(""); // Clear gameId input
    setEditSelectedWinnerCard(null);
  };

  // Handle card selection for award
  const handleCardSelect = (cardId) => {
    setAwardCardId(cardId.toString());
    setSelectedWinnerCard({ id: cardId, number: cardId });
  };

  // Handle card selection for edit
  const handleEditCardSelect = (cardId) => {
    setEditCardId(cardId.toString());
    setEditSelectedWinnerCard({ id: cardId, number: cardId });
  };

  // Calculate remaining amount for award
  const getRemainingAmount = () => {
    const awardAmt = parseFloat(awardAmount) || 0;
    return Math.max(0, (jackpot?.amount || 0) - awardAmt);
  };

  // Calculate remaining amount for edit
  const getEditRemainingAmount = () => {
    const editAmt = parseFloat(editAmount) || 0;
    const originalAmount =
      history.find((h) => h._id === editLogId)?.amount || 0;
    return Math.max(0, (jackpot?.amount || 0) + -originalAmount - editAmt);
  };

  // Award jackpot
  const handleAwardJackpot = async () => {
    const amountToAward = parseFloat(awardAmount);
    const cardId = parseInt(awardCardId);
    const gameId = awardGameId ? parseInt(awardGameId) : undefined;

    if (!amountToAward || amountToAward <= 0) {
      setError("Please enter a valid positive amount to award.");
      return;
    }

    if (!cardId || isNaN(cardId) || cardId < 1 || cardId > 100) {
      setError("Please enter a valid card number (1-100).");
      return;
    }

    if (amountToAward > jackpot.amount) {
      setError("Award amount cannot exceed current jackpot amount.");
      return;
    }

    if (!awardMessage.trim()) {
      setError("Please enter a message for the winner.");
      return;
    }

    if (gameId !== undefined && (isNaN(gameId) || gameId < 1)) {
      setError("Please enter a valid game number (1 or higher).");
      return;
    }

    try {
      setAwarding(true);
      setError("");
      const result = await moderatorService.awardJackpot(
        gameId,
        cardId,
        amountToAward,
        awardMessage
      );
      console.log("[JackpotManager] Award jackpot result:", result);
      const updatedJackpot = await moderatorService.getJackpot();
      console.log("[JackpotManager] Updated jackpot:", updatedJackpot);
      setJackpot(updatedJackpot);
      setEnabled(updatedJackpot.enabled);

      if (updatedJackpot.winnerCardId) {
        setAwardCardId(updatedJackpot.winnerCardId);
        setSelectedWinnerCard({
          id: parseInt(updatedJackpot.winnerCardId),
          number: parseInt(updatedJackpot.winnerCardId),
        });
      } else {
        setAwardCardId("");
        setSelectedWinnerCard(null);
      }

      const historyData = await moderatorService.getJackpotHistory();
      console.log("[JackpotManager] Updated history:", historyData);
      setHistory(Array.isArray(historyData) ? historyData : []);

      const remainingJackpot =
        result?.data?.remainingJackpot ?? updatedJackpot.amount;
      setSuccess(
        `🎉 Jackpot Awarded! ${amountToAward.toLocaleString()} BIRR to Card #${cardId}!${
          gameId !== undefined ? ` (Game #${gameId})` : ""
        }\n💬 Message: "${awardMessage}"\n💰 Remaining: ${remainingJackpot.toLocaleString()} BIRR`
      );
      setShowAwardModal(false);
    } catch (err) {
      console.error("[JackpotManager] Award jackpot error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to award jackpot. Please check details and try again."
      );
    } finally {
      setAwarding(false);
    }
  };

  // Delete award log
  const handleDeleteAward = async (logId) => {
    try {
      setUpdating(true);
      setError("");
      setSuccess("");
      const result = await moderatorService.deleteJackpotLog(logId);
      console.log("[JackpotManager] Delete award result:", result);
      const updatedJackpot = await moderatorService.getJackpot();
      setJackpot(updatedJackpot);
      setEnabled(updatedJackpot.enabled);

      if (updatedJackpot.winnerCardId) {
        setAwardCardId(updatedJackpot.winnerCardId);
        setSelectedWinnerCard({
          id: parseInt(updatedJackpot.winnerCardId),
          number: parseInt(updatedJackpot.winnerCardId),
        });
      } else {
        setAwardCardId("");
        setSelectedWinnerCard(null);
      }

      const historyData = await moderatorService.getJackpotHistory();
      console.log(
        "[JackpotManager] Updated history after delete:",
        historyData
      );
      setHistory(Array.isArray(historyData) ? historyData : []);

      setSuccess(
        `Award deleted successfully! Restored ${result.data.restoredAmount.toLocaleString()} BIRR to jackpot.`
      );
    } catch (err) {
      console.error("[JackpotManager] Delete award error:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to delete award."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Update award log
  const handleUpdateAward = async () => {
    const amountToUpdate = parseFloat(editAmount);
    const cardId = parseInt(editCardId);
    const gameId = editGameId ? parseInt(editGameId) : undefined;

    if (!amountToUpdate || amountToUpdate <= 0) {
      setError("Please enter a valid positive amount to update.");
      return;
    }

    if (!cardId || isNaN(cardId) || cardId < 1 || cardId > 100) {
      setError("Please enter a valid card number (1-100).");
      return;
    }

    if (
      amountToUpdate >
      jackpot.amount + -(history.find((h) => h._id === editLogId)?.amount || 0)
    ) {
      setError("Updated amount cannot exceed available jackpot amount.");
      return;
    }

    if (!editMessage.trim()) {
      setError("Please enter a message for the winner.");
      return;
    }

    if (gameId !== undefined && (isNaN(gameId) || gameId < 1)) {
      setError("Please enter a valid game number (1 or higher).");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      const result = await moderatorService.updateJackpotLog(
        editLogId,
        amountToUpdate,
        cardId,
        editMessage,
        gameId
      );
      console.log("[JackpotManager] Update award result:", result);
      const updatedJackpot = await moderatorService.getJackpot();
      setJackpot(updatedJackpot);
      setEnabled(updatedJackpot.enabled);

      if (updatedJackpot.winnerCardId) {
        setAwardCardId(updatedJackpot.winnerCardId);
        setSelectedWinnerCard({
          id: parseInt(updatedJackpot.winnerCardId),
          number: parseInt(updatedJackpot.winnerCardId),
        });
      } else {
        setAwardCardId("");
        setSelectedWinnerCard(null);
      }

      const historyData = await moderatorService.getJackpotHistory();
      console.log(
        "[JackpotManager] Updated history after update:",
        historyData
      );
      setHistory(Array.isArray(historyData) ? historyData : []);

      setSuccess(
        `Award updated successfully! ${amountToUpdate.toLocaleString()} BIRR to Card #${cardId}${
          gameId !== undefined ? ` (Game #${gameId})` : ""
        }.`
      );
      setShowEditModal(false);
    } catch (err) {
      console.error("[JackpotManager] Update award error:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to update award."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Refresh jackpot data
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await fetchData();
      setSuccess("Data refreshed successfully!");
    } catch (err) {
      console.error("[JackpotManager] Refresh error:", err);
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

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading...</p>
          </div>
        )}

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

        {jackpot && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    Current Winner:
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {jackpot.winnerCardId
                      ? `Card #${jackpot.winnerCardId}`
                      : "None"}
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

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <span className="mr-2">⚙️</span>
                Jackpot Controls
              </h3>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add to Jackpot
                </label>
                <div className="space-y-3">
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
                    <input
                      type="number"
                      value={addGameId}
                      onChange={(e) => setAddGameId(e.target.value)}
                      placeholder="Game number (optional)"
                      className="w-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={updating}
                      min="1"
                    />
                  </div>
                  <button
                    onClick={handleAddAmount}
                    disabled={
                      updating || !addAmount || parseFloat(addAmount) <= 0
                    }
                    className={`w-full px-4 py-3 rounded-lg text-white font-medium transition-all duration-200 ${
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
                  {addGameId && (
                    <span className="text-blue-600 dark:text-blue-400">
                      {", Game #" + addGameId}
                    </span>
                  )}
                </p>
              </div>

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
                    ? "Jackpot is currently active and can be awarded"
                    : "Jackpot is disabled - no awards possible"}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Award Jackpot
                </label>
                <button
                  onClick={handleOpenAwardModal}
                  disabled={awarding || jackpot.amount === 0 || !enabled}
                  className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                    awarding || jackpot.amount === 0 || !enabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  }`}
                >
                  {awarding
                    ? "Awarding..."
                    : `🎉 Award Jackpot (${jackpot.amount.toLocaleString()} BIRR)`}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {jackpot.amount > 0 && enabled
                    ? `Set or update the jackpot winner, amount, game number, and message`
                    : jackpot.amount === 0
                    ? "No jackpot amount available to award"
                    : "Jackpot must be enabled to award"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Jackpot Award History
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No jackpot awards yet.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Awarded jackpots will appear here.
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
                      Winner Card
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Game Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cashier ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {history.map((transaction) => (
                    <tr
                      key={transaction._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          {-transaction.amount} BIRR
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        Card #{transaction.winnerCardId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.game?.gameNumber || "None"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {transaction.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.triggeredByCashier
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {transaction.triggeredByCashier
                            ? "Triggered"
                            : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.cashierId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {!transaction.triggeredByCashier && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(transaction)}
                              disabled={updating}
                              className={`px-3 py-1 rounded-lg text-white text-xs font-medium transition-all duration-200 ${
                                updating
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAward(transaction._id)}
                              disabled={updating}
                              className={`px-3 py-1 rounded-lg text-white text-xs font-medium transition-all duration-200 ${
                                updating
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-red-600 hover:bg-red-700"
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
                {history.filter((h) => !h.triggeredByCashier).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pending Awards
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {history.filter((h) => h.triggeredByCashier).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Triggered Awards
              </div>
            </div>
          </div>
        )}

        {showAwardModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <span className="mr-2">🎉</span>
                  {jackpot.winnerCardId
                    ? "Update Jackpot Winner"
                    : "Set Jackpot Winner"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {jackpot.winnerCardId
                    ? "Update the winner, amount, game number, and message for the jackpot"
                    : "Configure the jackpot winner, amount, game number, and message"}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Current Jackpot
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {jackpot.amount.toLocaleString()} BIRR
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount to Award
                  </label>
                  <input
                    type="number"
                    value={awardAmount}
                    onChange={(e) => setAwardAmount(e.target.value)}
                    placeholder="Enter amount (max: current jackpot)"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={awarding}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Card
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={awardCardId}
                      onChange={(e) => {
                        setAwardCardId(e.target.value);
                        if (e.target.value) {
                          handleCardSelect(parseInt(e.target.value));
                        } else {
                          setSelectedWinnerCard(null);
                        }
                      }}
                      placeholder="Enter card number (1-100)"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pr-24"
                      disabled={awarding}
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
                  {jackpot.winnerCardId && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Current Winner: Card #{jackpot.winnerCardId}. You are
                      updating the winner.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Game Number (Optional)
                  </label>
                  <input
                    type="number"
                    value={awardGameId}
                    onChange={(e) => setAwardGameId(e.target.value)}
                    placeholder="Enter game number"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={awarding}
                    min="1"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {awardGameId ? `Game #${awardGameId}` : "No game selected"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Message
                  </label>
                  <textarea
                    value={awardMessage}
                    onChange={(e) => setAwardMessage(e.target.value)}
                    placeholder="Enter message for the winner"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows="3"
                    disabled={awarding}
                    maxLength="200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {awardMessage.length}/200 characters
                  </p>
                </div>

                {awardAmount && awardCardId && awardMessage.trim() && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Award Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Amount to Award:
                      </div>
                      <div className="font-semibold text-right">
                        {awardAmount
                          ? `${parseFloat(awardAmount).toLocaleString()} BIRR`
                          : "0 BIRR"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Winner Card:
                      </div>
                      <div className="font-semibold text-right">
                        {awardCardId ? `#${awardCardId}` : "Not selected"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Game Number:
                      </div>
                      <div className="font-semibold text-right">
                        {awardGameId ? `#${awardGameId}` : "None"}
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

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex space-x-3 justify-end">
                <button
                  onClick={handleCloseAwardModal}
                  disabled={awarding}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAwardJackpot}
                  disabled={
                    awarding ||
                    !awardAmount ||
                    !awardCardId ||
                    !awardMessage.trim() ||
                    parseFloat(awardAmount) <= 0 ||
                    parseInt(awardCardId) < 1 ||
                    parseInt(awardCardId) > 100
                  }
                  className={`px-6 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                    awarding ||
                    !awardAmount ||
                    !awardCardId ||
                    !awardMessage.trim() ||
                    parseFloat(awardAmount) <= 0 ||
                    parseInt(awardCardId) < 1 ||
                    parseInt(awardCardId) > 100
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  }`}
                >
                  {awarding ? (
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
                      Awarding...
                    </span>
                  ) : jackpot.winnerCardId ? (
                    "Update Winner"
                  ) : (
                    "Set Winner"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <span className="mr-2">✏️</span>
                  Edit Jackpot Award
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Update the winner, amount, game number, and message for this
                  award
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Current Jackpot
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {jackpot.amount.toLocaleString()} BIRR
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount to Award
                  </label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={updating}
                    min="0.01"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Remaining:{" "}
                    <span className="font-medium">
                      {getEditRemainingAmount().toLocaleString()} BIRR
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Card
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editCardId}
                      onChange={(e) => {
                        setEditCardId(e.target.value);
                        if (e.target.value) {
                          handleEditCardSelect(parseInt(e.target.value));
                        } else {
                          setEditSelectedWinnerCard(null);
                        }
                      }}
                      placeholder="Enter card number (1-100)"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pr-24"
                      disabled={updating}
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
                  {editSelectedWinnerCard && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      Selected: Card #{editSelectedWinnerCard.number}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Game Number (Optional)
                  </label>
                  <input
                    type="number"
                    value={editGameId}
                    onChange={(e) => setEditGameId(e.target.value)}
                    placeholder="Enter game number"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={updating}
                    min="1"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {editGameId ? `Game #${editGameId}` : "No game selected"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winner Message
                  </label>
                  <textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    placeholder="Enter message for the winner"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows="3"
                    disabled={updating}
                    maxLength="200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {editMessage.length}/200 characters
                  </p>
                </div>

                {editAmount && editCardId && editMessage.trim() && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Updated Award Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Amount to Award:
                      </div>
                      <div className="font-semibold text-right">
                        {editAmount
                          ? `${parseFloat(editAmount).toLocaleString()} BIRR`
                          : "0 BIRR"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Winner Card:
                      </div>
                      <div className="font-semibold text-right">
                        {editCardId ? `#${editCardId}` : "Not selected"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Game Number:
                      </div>
                      <div className="font-semibold text-right">
                        {editGameId ? `#${editGameId}` : "None"}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Remaining:
                      </div>
                      <div className="font-semibold text-right text-green-600 dark:text-green-400">
                        {getEditRemainingAmount().toLocaleString()} BIRR
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex space-x-3 justify-end">
                <button
                  onClick={handleCloseEditModal}
                  disabled={updating}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAward}
                  disabled={
                    updating ||
                    !editAmount ||
                    !editCardId ||
                    !editMessage.trim() ||
                    parseFloat(editAmount) <= 0 ||
                    parseInt(editCardId) < 1 ||
                    parseInt(editCardId) > 100
                  }
                  className={`px-6 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                    updating ||
                    !editAmount ||
                    !editCardId ||
                    !editMessage.trim() ||
                    parseFloat(editAmount) <= 0 ||
                    parseInt(editCardId) < 1 ||
                    parseInt(editCardId) > 100
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  }`}
                >
                  {updating ? (
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
                      Updating...
                    </span>
                  ) : (
                    "Update Award"
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
