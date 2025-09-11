import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ModeratorLayout from "../../components/moderator/ModeratorLayout";
import gameService from "../../services/game";
import moderatorService from "../../services/moderator";

export default function ModeratorDashboard() {
  const navigate = useNavigate();

  const [activeGames, setActiveGames] = useState([]);
  const [completedGames, setCompletedGames] = useState([]);
  const [pendingGames, setPendingGames] = useState([]);
  const [selectedNextGame, setSelectedNextGame] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalGameId, setModalGameId] = useState(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [callNumberModalOpen, setCallNumberModalOpen] = useState(false);
  const [callNumberGameId, setCallNumberGameId] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState("");
  const [callNumberError, setCallNumberError] = useState(null);
  const [callNumberLoading, setCallNumberLoading] = useState(false);
  const [allCards, setAllCards] = useState([]);
  const [futureWinnerModalOpen, setFutureWinnerModalOpen] = useState(false);
  const [futureGameNumber, setFutureGameNumber] = useState("");
  const [futureWinnerCardId, setFutureWinnerCardId] = useState("");

  // Function to fetch all games
  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const allGames = await gameService.getAllGames();
      // Categorize games by status
      setActiveGames(allGames.filter((g) => g.status === "active"));
      setCompletedGames(allGames.filter((g) => g.status === "completed"));
      setPendingGames(allGames.filter((g) => g.status === "pending"));
    } catch (err) {
      setError("Failed to fetch games. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch all cards
  const fetchAllCards = async () => {
    try {
      const cards = await gameService.getAllCards();
      setAllCards(cards);
    } catch (err) {
      console.error("Failed to fetch cards", err);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchAllCards();
  }, []);

  const handleToggleJackpot = async (gameId, currentEnabled) => {
    setLoading(true);
    setError(null);
    try {
      const updatedGame = await moderatorService.updateGame(gameId, {
        jackpotEnabled: !currentEnabled,
      });

      // Update the game in the appropriate state array
      if (updatedGame.status === "active") {
        setActiveGames((prev) =>
          prev.map((g) =>
            g._id === gameId
              ? { ...g, jackpotEnabled: updatedGame.jackpotEnabled }
              : g
          )
        );
      } else if (updatedGame.status === "completed") {
        setCompletedGames((prev) =>
          prev.map((g) =>
            g._id === gameId
              ? { ...g, jackpotEnabled: updatedGame.jackpotEnabled }
              : g
          )
        );
      }
    } catch (err) {
      setError("Failed to toggle jackpot. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNextGame = async () => {
    if (!selectedNextGame) {
      setError("Please select a game to start.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedGame = await moderatorService.startGame(selectedNextGame);
      setPendingGames((prev) => prev.filter((g) => g._id !== selectedNextGame));
      setActiveGames((prev) => [updatedGame, ...prev]);
      setSelectedNextGame("");
    } catch (err) {
      setError("Failed to start game. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openWinnerModal = (gameId, currentWinnerId) => {
    setModalGameId(gameId);
    setSelectedWinnerId(currentWinnerId ? String(currentWinnerId) : "");
    setModalError(null);
    setModalOpen(true);
  };

  const handleSetWinner = async () => {
    if (!modalGameId || !selectedWinnerId) {
      setModalError("Please select a winning card ID.");
      return;
    }
    const cardId = parseInt(selectedWinnerId, 10);
    if (isNaN(cardId) || cardId < 1) {
      setModalError("Invalid card ID.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const updatedGame = await moderatorService.setWinnerById(
        modalGameId,
        cardId
      );

      // Update the game in the pending games array
      setPendingGames((prev) =>
        prev.map((g) =>
          g._id === modalGameId ? { ...g, moderatorWinnerCardId: cardId } : g
        )
      );

      setModalOpen(false);
      setSelectedWinnerId("");
    } catch (err) {
      setModalError("Failed to set winner. Please try again.");
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleFinishGame = async (gameId) => {
    setLoading(true);
    setError(null);
    try {
      const updatedGame = await moderatorService.finishGame(gameId);

      setActiveGames((prev) =>
        prev.map((g) => (g._id === gameId ? { ...g, status: "completed" } : g))
      );

      const finishedGame = activeGames.find((g) => g._id === gameId);
      if (finishedGame) {
        setCompletedGames((prev) => [
          ...prev,
          { ...finishedGame, status: "completed" },
        ]);
        setActiveGames((prev) => prev.filter((g) => g._id !== gameId));
      }
    } catch (err) {
      setError("Failed to finish game. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCallNumberModal = (gameId) => {
    setCallNumberGameId(gameId);
    setSelectedNumber("");
    setCallNumberError(null);
    setCallNumberModalOpen(true);
  };

  const handleCallNumber = async () => {
    if (!callNumberGameId || !selectedNumber) {
      setCallNumberError("Please select a number to call.");
      return;
    }

    const number = parseInt(selectedNumber, 10);
    if (isNaN(number) || number < 1 || number > 75) {
      setCallNumberError("Invalid number. Must be between 1 and 75.");
      return;
    }

    setCallNumberLoading(true);
    setCallNumberError(null);
    try {
      const response = await moderatorService.callNumber(
        callNumberGameId,
        number
      );

      setActiveGames((prev) =>
        prev.map((g) =>
          g._id === callNumberGameId
            ? { ...g, calledNumbers: response.game.calledNumbers }
            : g
        )
      );

      setCallNumberModalOpen(false);
      setSelectedNumber("");
    } catch (err) {
      setCallNumberError("Failed to call number. Please try again.");
      console.error(err);
    } finally {
      setCallNumberLoading(false);
    }
  };

  const openFutureWinnerModal = () => {
    setFutureGameNumber("");
    setFutureWinnerCardId("");
    setModalError(null);
    setFutureWinnerModalOpen(true);
  };

  const handleConfigureFutureWinner = async () => {
    if (!futureGameNumber || !futureWinnerCardId) {
      setModalError("Please enter a game number and select a winning card.");
      return;
    }

    const gameNumber = parseInt(futureGameNumber, 10);
    const cardId = parseInt(futureWinnerCardId, 10);
    if (isNaN(gameNumber) || gameNumber < 1) {
      setModalError("Invalid game number.");
      return;
    }
    if (isNaN(cardId) || cardId < 1) {
      setModalError("Invalid card ID.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const response = await moderatorService.configureFutureWinners([
        { gameNumber, cardId },
      ]);

      // Refresh games to reflect the new or updated game
      await fetchGames();

      setFutureWinnerModalOpen(false);
      setFutureGameNumber("");
      setFutureWinnerCardId("");
    } catch (err) {
      setModalError("Failed to configure future winner. Please try again.");
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <ModeratorLayout>
      <div className="container mx-auto p-6 space-y-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Moderator Dashboard
        </h2>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading...</p>
          </div>
        )}

        {/* Configure Game */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Configure Next Game
          </h3>
          <button
            onClick={openFutureWinnerModal}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all duration-200"
          >
            Configure Future Winner
          </button>
        </div>

        {/* Pending Games Table */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            Pending Games
          </h3>
          {pendingGames.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No pending games available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    <th className="border-b px-4 py-3 text-left">Game #</th>
                    <th className="border-b px-4 py-3 text-left">Pattern</th>
                    <th className="border-b px-4 py-3 text-left">Cards</th>
                    <th className="border-b px-4 py-3 text-left">Winner</th>
                    <th className="border-b px-4 py-3 text-left">Jackpot</th>
                    <th className="border-b px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGames.map((game) => (
                    <tr
                      key={game._id}
                      className="hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors duration-200"
                    >
                      <td className="border-b px-4 py-3">{game.gameNumber}</td>
                      <td className="border-b px-4 py-3">
                        {game.pattern.replaceAll("_", " ")}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.selectedCards.length}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.moderatorWinnerCardId || "None"}
                      </td>
                      <td className="border-b px-4 py-3">
                        <input
                          type="checkbox"
                          checked={game.jackpotEnabled}
                          onChange={() =>
                            handleToggleJackpot(game._id, game.jackpotEnabled)
                          }
                          disabled={loading}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="border-b px-4 py-3 space-y-2 sm:space-y-0 sm:space-x-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() =>
                              openWinnerModal(
                                game._id,
                                game.moderatorWinnerCardId
                              )
                            }
                            className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-all duration-200 text-sm"
                          >
                            Set Winner
                          </button>
                          <button
                            onClick={() => setSelectedNextGame(game._id)}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm"
                          >
                            Select to Start
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Start Next Game */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Start Next Game
          </h3>
          {pendingGames.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No pending games available.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
              <select
                value={selectedNextGame}
                onChange={(e) => setSelectedNextGame(e.target.value)}
                className="w-full sm:w-2/3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={loading}
              >
                <option value="">Select a pending game</option>
                {pendingGames.map((game) => (
                  <option key={game._id} value={game._id}>
                    Game #{game.gameNumber} (Pattern:{" "}
                    {game.pattern.replaceAll("_", " ")}, Winner Card:{" "}
                    {game.moderatorWinnerCardId || "None"})
                  </option>
                ))}
              </select>
              <button
                onClick={handleStartNextGame}
                disabled={loading || !selectedNextGame}
                className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Start Game
              </button>
            </div>
          )}
        </div>

        {/* Active Games Table */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            Active Games
          </h3>
          {activeGames.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No active games.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    <th className="border-b px-4 py-3 text-left">Game #</th>
                    <th className="border-b px-4 py-3 text-left">Pattern</th>
                    <th className="border-b px-4 py-3 text-left">Cards</th>
                    <th className="border-b px-4 py-3 text-left">Called</th>
                    <th className="border-b px-4 py-3 text-left">Winner</th>
                    <th className="border-b px-4 py-3 text-left">Jackpot</th>
                    <th className="border-b px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGames.map((game) => (
                    <tr
                      key={game._id}
                      className="hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors duration-200"
                    >
                      <td className="border-b px-4 py-3">{game.gameNumber}</td>
                      <td className="border-b px-4 py-3">
                        {game.pattern.replaceAll("_", " ")}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.selectedCards.length}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.calledNumbers.length}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.moderatorWinnerCardId || "None"}
                      </td>
                      <td className="border-b px-4 py-3">
                        <input
                          type="checkbox"
                          checked={game.jackpotEnabled}
                          onChange={() =>
                            handleToggleJackpot(game._id, game.jackpotEnabled)
                          }
                          disabled={loading}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="border-b px-4 py-3 space-y-2 sm:space-y-0 sm:space-x-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => openCallNumberModal(game._id)}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm"
                          >
                            Call Number
                          </button>
                          <button
                            onClick={() => handleFinishGame(game._id)}
                            className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm"
                          >
                            Finish Game
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/bingo-game?id=${game._id}`)
                            }
                            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 text-sm"
                          >
                            Go to Game
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Started and Completed Games Table (Non-editable) */}
        <div className="bg-red-50 dark:bg-red-900/50 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
            Started and Completed Games (Non-editable)
          </h3>
          {activeGames.length === 0 && completedGames.length === 0 ? (
            <p className="text-red-500 dark:text-red-400">
              No started or completed games.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200">
                    <th className="border-b px-4 py-3 text-left">Game #</th>
                    <th className="border-b px-4 py-3 text-left">Status</th>
                    <th className="border-b px-4 py-3 text-left">Pattern</th>
                    <th className="border-b px-4 py-3 text-left">Cards</th>
                    <th className="border-b px-4 py-3 text-left">Called</th>
                    <th className="border-b px-4 py-3 text-left">Winner</th>
                    <th className="border-b px-4 py-3 text-left">Prize</th>
                    <th className="border-b px-4 py-3 text-left">Jackpot</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeGames, ...completedGames].map((game) => (
                    <tr
                      key={game._id}
                      className="hover:bg-red-100 dark:hover:bg-red-800/50 transition-colors duration-200"
                    >
                      <td className="border-b px-4 py-3">{game.gameNumber}</td>
                      <td className="border-b px-4 py-3">{game.status}</td>
                      <td className="border-b px-4 py-3">
                        {game.pattern.replaceAll("_", " ")}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.selectedCards.length}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.calledNumbers.length}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.moderatorWinnerCardId ||
                          game.winner?.cardId ||
                          "None"}
                      </td>
                      <td className="border-b px-4 py-3">
                        ${game.winner?.prize || 0}
                      </td>
                      <td className="border-b px-4 py-3">
                        {game.jackpotEnabled ? "Enabled" : "Disabled"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Winner Modal (for pending games) */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Set Winning Card for Game
              </h3>
              {modalError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                  {modalError}
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winning Card ID
                  </label>
                  <select
                    value={selectedWinnerId}
                    onChange={(e) => setSelectedWinnerId(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={modalLoading}
                  >
                    <option value="">Select Card ID</option>
                    {pendingGames
                      .find((g) => g._id === modalGameId)
                      ?.selectedCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          Card #{card.id}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetWinner}
                    disabled={modalLoading || !selectedWinnerId}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    {modalLoading && (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
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
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Number Modal */}
        {callNumberModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Call Number
              </h3>
              {callNumberError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                  {callNumberError}
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number to Call (1-75)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="75"
                    value={selectedNumber}
                    onChange={(e) => setSelectedNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={callNumberLoading}
                    placeholder="Enter number between 1-75"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setCallNumberModalOpen(false)}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCallNumber}
                    disabled={callNumberLoading || !selectedNumber}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    {callNumberLoading && (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
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
                    )}
                    Call Number
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Future Winner Modal */}
        {futureWinnerModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Configure Future Game Winner
              </h3>
              {modalError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                  {modalError}
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Game Number
                  </label>
                  <input
                    type="number"
                    value={futureGameNumber}
                    onChange={(e) => setFutureGameNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter future game number (e.g., 10)"
                    min="1"
                    disabled={modalLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Winning Card ID
                  </label>
                  <select
                    value={futureWinnerCardId}
                    onChange={(e) => setFutureWinnerCardId(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={modalLoading}
                  >
                    <option value="">Select Card ID</option>
                    {allCards.map((card) => (
                      <option key={card.cardId} value={card.cardId}>
                        Card #{card.cardId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setFutureWinnerModalOpen(false)}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfigureFutureWinner}
                    disabled={
                      modalLoading || !futureGameNumber || !futureWinnerCardId
                    }
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    {modalLoading && (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
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
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModeratorLayout>
  );
}
