import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ModeratorLayout from "../../components/moderator/ModeratorLayout";
import moderatorService from "../../services/moderator";
import API from "../../services/axios";

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
  const [cardSetModalOpen, setCardSetModalOpen] = useState(false);
  const [selectedCardSet, setSelectedCardSet] = useState([]);
  const [gameNumberInput, setGameNumberInput] = useState("");
  const [selectedWinnerCard, setSelectedWinnerCard] = useState(""); // New state for winner card

  // Function to fetch all games
  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get("/games");
      const allGames = response.data.data;

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
      const response = await API.get("/games/cards");
      setAllCards(response.data.data);
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

  const openCardSetModal = () => {
    setSelectedCardSet([]);
    setSelectedWinnerCard(""); // Reset winner card
    setGameNumberInput("");
    setCardSetModalOpen(true);
  };

  const handleCardSelection = (cardId) => {
    setSelectedCardSet((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  const handleWinnerCardSelection = (cardId) => {
    setSelectedWinnerCard(cardId); // Set single winner card
  };

  const handleCreateGameWithCardSet = async () => {
    if (selectedCardSet.length === 0) {
      setError("Please select at least one card.");
      return;
    }

    if (!gameNumberInput) {
      setError("Please enter a game number.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await API.post("/games", {
        selectedCards: selectedCardSet,
        pattern: "full_house",
        gameNumber: parseInt(gameNumberInput, 10),
        moderatorWinnerCardId: selectedWinnerCard || null, // Include winner card
      });

      if (response.data && response.data.data) {
        setPendingGames((prev) => [...prev, response.data.data]);
        setCardSetModalOpen(false);
        setSelectedCardSet([]);
        setSelectedWinnerCard("");
        setGameNumberInput("");
      }
    } catch (err) {
      setError("Failed to create game. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModeratorLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Moderator Dashboard
        </h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm transition-all duration-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading...</p>
          </div>
        )}

        {/* Create New Game with Card Set */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Create Next Game
          </h3>
          <button
            onClick={openCardSetModal}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all duration-200"
          >
            Select Card Set & Winner
          </button>
        </div>

        {/* Start Next Game */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Start Next Game
          </h3>
          {pendingGames.length === 0 ? (
            <p className="text-gray-500">No pending games available.</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
              <select
                value={selectedNextGame}
                onChange={(e) => setSelectedNextGame(e.target.value)}
                className="w-full sm:w-2/3 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-indigo-600 mb-4">
            Active Games
          </h3>
          {activeGames.length === 0 ? (
            <p className="text-gray-500">No active games.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-800">
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
                      className="hover:bg-indigo-50 transition-colors duration-200"
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

        {/* Completed Games Table */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-600 mb-4">
            Completed Games
          </h3>
          {completedGames.length === 0 ? (
            <p className="text-gray-500">No completed games.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-800">
                    <th className="border-b px-4 py-3 text-left">Game #</th>
                    <th className="border-b px-4 py-3 text-left">Pattern</th>
                    <th className="border-b px-4 py-3 text-left">Cards</th>
                    <th className="border-b px-4 py-3 text-left">Called</th>
                    <th className="border-b px-4 py-3 text-left">Winner</th>
                    <th className="border-b px-4 py-3 text-left">Prize</th>
                    <th className="border-b px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedGames.map((game) => (
                    <tr
                      key={game._id}
                      className="hover:bg-gray-50 transition-colors duration-200"
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
                        {game.moderatorWinnerCardId ||
                          game.winner?.cardId ||
                          "None"}
                      </td>
                      <td className="border-b px-4 py-3">
                        ${game.winner?.prize || 0}
                      </td>
                      <td className="border-b px-4 py-3">
                        <button
                          onClick={() =>
                            openWinnerModal(
                              game._id,
                              game.moderatorWinnerCardId || game.winner?.cardId
                            )
                          }
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all duration-200 text-sm"
                          disabled // Disable for completed games
                        >
                          View Winner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Winner Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">
                Set Winning Card for Next Game
              </h3>
              {modalError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                  {modalError}
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Winning Card ID
                  </label>
                  <select
                    value={selectedWinnerId}
                    onChange={(e) => setSelectedWinnerId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">
                Call Number
              </h3>
              {callNumberError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
                  {callNumberError}
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number to Call (1-75)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="75"
                    value={selectedNumber}
                    onChange={(e) => setSelectedNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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

        {/* Card Set Selection Modal */}
        {cardSetModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300 overflow-y-auto">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full transform transition-all duration-300 scale-100 my-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">
                Select Card Set & Winner for Next Game
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Number
                  </label>
                  <input
                    type="number"
                    value={gameNumberInput}
                    onChange={(e) => setGameNumberInput(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Enter game number (e.g., 2)"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Cards (Click to select/deselect)
                  </label>
                  <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                    {allCards.map((card) => (
                      <div
                        key={card.cardId}
                        onClick={() => handleCardSelection(card.cardId)}
                        className={`p-2 border rounded cursor-pointer text-center ${
                          selectedCardSet.includes(card.cardId)
                            ? "bg-indigo-100 border-indigo-500"
                            : "border-gray-300"
                        }`}
                      >
                        Card #{card.cardId}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Selected: {selectedCardSet.length} cards
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Winning Card (Choose one)
                  </label>
                  <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                    {allCards.map((card) => (
                      <div
                        key={card.cardId}
                        onClick={() => handleWinnerCardSelection(card.cardId)}
                        className={`p-2 border rounded cursor-pointer text-center ${
                          selectedWinnerCard === card.cardId
                            ? "bg-green-100 border-green-500"
                            : "border-gray-300"
                        }`}
                      >
                        Card #{card.cardId}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Selected Winner: {selectedWinnerCard || "None"}
                  </p>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setCardSetModalOpen(false)}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGameWithCardSet}
                    disabled={
                      loading ||
                      selectedCardSet.length === 0 ||
                      !gameNumberInput
                    }
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    {loading && (
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
                    Create Game
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
