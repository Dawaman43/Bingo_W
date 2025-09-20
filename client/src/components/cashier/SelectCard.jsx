import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gameService from "../../services/game";
import moderatorService from "../../services/moderator";
import { useAuth } from "../../context/AuthContext";

const SelectCard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [betAmount, setBetAmount] = useState(
    localStorage.getItem("betAmount") || "10"
  );
  const [housePercentage, setHousePercentage] = useState(
    localStorage.getItem("housePercentage") || "15"
  );
  const [pattern, setPattern] = useState(
    localStorage.getItem("gamePattern") || "all"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [loadingGame, setLoadingGame] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [profitData, setProfitData] = useState({
    totalPot: 0,
    houseFee: 0,
    prizePool: 0,
    jackpotAmount: 0,
  });
  const [showProfit, setShowProfit] = useState(false);
  const [validCardIds, setValidCardIds] = useState([]);

  const cardsPerPage = 100;
  const cardsPerRow = 20;

  const validPatterns = [
    { value: "four_corners_center", label: "Four Corners + Center" },
    { value: "cross", label: "Cross" },
    {
      value: "main_diagonal",
      label: "Main Diagonal (Top-Left to Bottom-Right)",
    },
    {
      value: "other_diagonal",
      label: "Other Diagonal (Top-Right to Bottom-Left)",
    },
    { value: "horizontal_line", label: "Horizontal Line" },
    { value: "vertical_line", label: "Vertical Line" },
    { value: "all", label: "Any Pattern" },
  ];

  useEffect(() => {
    const fetchCards = async () => {
      setCardsLoading(true);
      try {
        console.log("[SelectCard] Fetching cards...");
        const data = await gameService.getAllCards();
        console.log("[SelectCard] Fetched cards:", data);
        if (data && Array.isArray(data) && data.length > 0) {
          const sortedCards = data
            .map((c, index) => ({
              id: c.cardId || c.id || c.card_number || index + 1,
              card_number: c.card_number || c.id || index + 1,
            }))
            .sort((a, b) => a.card_number - b.card_number);
          setCards(sortedCards);
          setValidCardIds(sortedCards.map((card) => card.id));
        } else {
          console.warn("[SelectCard] No cards received, using default cards");
          const defaultCards = Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            card_number: i + 1,
          }));
          setCards(defaultCards);
          setValidCardIds(defaultCards.map((card) => card.id));
          showAlert(
            "No cards found from server, using default set (1-100)",
            "warning"
          );
        }
      } catch (error) {
        console.error("[SelectCard] Error fetching cards:", error.message);
        const defaultCards = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          card_number: i + 1,
        }));
        setCards(defaultCards);
        setValidCardIds(Array.from({ length: 100 }, (_, i) => i + 1));
        showAlert(
          "Failed to load cards from server, using default set (1-100)",
          "error"
        );
      } finally {
        setCardsLoading(false);
      }
    };
    if (!loading && user) fetchCards();
  }, [loading, user]);

  useEffect(() => {
    const savedSelectedCards = localStorage.getItem("selectedCards");
    if (savedSelectedCards) {
      try {
        const parsedCards = JSON.parse(savedSelectedCards);
        const validSavedCards = parsedCards.filter((cardId) =>
          validCardIds.includes(cardId)
        );
        if (validSavedCards.length > 0) {
          setSelectedCards(validSavedCards);
          showAlert(
            `${validSavedCards.length} previously selected cards restored`,
            "info"
          );
        }
      } catch (error) {
        console.error("[SelectCard] Error parsing selected cards:", error);
      }
    }
  }, [validCardIds]);

  useEffect(() => {
    if (selectedCards.length > 0) {
      localStorage.setItem("selectedCards", JSON.stringify(selectedCards));
    } else {
      localStorage.removeItem("selectedCards");
    }
  }, [selectedCards]);

  useEffect(() => {
    calculateProfit();
  }, [betAmount, housePercentage, selectedCards]);

  const calculateProfit = () => {
    const bet = parseFloat(betAmount) || 0;
    const percentage = parseFloat(housePercentage) || 0;
    const selectedCount = selectedCards.length;
    if (bet <= 0 || selectedCount <= 0) {
      setProfitData({
        totalPot: "0.00",
        houseFee: "0.00",
        prizePool: "0.00",
        jackpotAmount: "0.00",
      });
      return;
    }
    const totalPot = bet * selectedCount;
    const jackpotAmount = bet * selectedCount * 0.1; // 10% for jackpot
    const houseFee = (totalPot * percentage) / 100;
    const prizePool = totalPot - houseFee - jackpotAmount;
    setProfitData({
      totalPot: totalPot.toFixed(2),
      houseFee: houseFee.toFixed(2),
      prizePool: prizePool.toFixed(2),
      jackpotAmount: jackpotAmount.toFixed(2),
    });
  };

  const toggleCardSelection = (cardId, cardNumber) => {
    if (!validCardIds.includes(cardId)) {
      showAlert(`Card #${cardNumber} is not available`, "error");
      return;
    }
    setSelectedCards((prev) => {
      const index = prev.indexOf(cardId);
      if (index === -1) {
        showAlert(`Card #${cardNumber} selected`, "success");
        return [...prev, cardId];
      } else {
        showAlert(`Card #${cardNumber} deselected`, "success");
        return prev.filter((id) => id !== cardId);
      }
    });
  };

  const showAlert = (message, type = "success") => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: "", type: "" }), 3000);
  };

  const validateGameData = () => {
    const bet = parseFloat(betAmount);
    const percentage = parseInt(housePercentage);
    if (!bet || bet <= 0)
      return "Please enter a valid bet amount (must be greater than 0)";
    if (selectedCards.length === 0) return "Please select at least one card";
    if (selectedCards.length > 100) return "Cannot select more than 100 cards";
    if (!validPatterns.map((p) => p.value).includes(pattern))
      return "Please select a valid game pattern";
    if (percentage < 0 || percentage > 100)
      return "House fee percentage must be between 0 and 100";
    const invalidCards = selectedCards.filter(
      (id) => !validCardIds.includes(id)
    );
    if (invalidCards.length > 0)
      return `Invalid card IDs: ${invalidCards.join(", ")}`;
    return null;
  };

  const handleStartGame = async () => {
    if (loading) {
      showAlert("Please wait, authenticating user...", "warning");
      return;
    }
    if (!user || !user.id) {
      showAlert("You must be logged in to start a game", "error");
      navigate("/login");
      return;
    }

    const validationError = validateGameData();
    if (validationError) {
      showAlert(validationError, "error");
      return;
    }

    setLoadingGame(true);

    try {
      // Save settings locally
      localStorage.setItem("betAmount", betAmount);
      localStorage.setItem("housePercentage", housePercentage);
      localStorage.setItem("gamePattern", pattern);

      // Prepare payload
      const payload = {
        startGameNumber: 1,
        numGames: 1, // always create 1 game
        pattern,
        betAmount: parseFloat(betAmount),
        houseFeePercentage: parseInt(housePercentage),
        jackpotEnabled: true,
        cardPool: selectedCards.map((id) => Number(id)),
      };

      console.log("[SelectCard] Creating game with payload:", payload);

      // Call backend service
      const data = await gameService.createSequentialGames(payload);
      console.log("[SelectCard] Raw create game response:", data);

      // Extract game object
      const game = data?.game || (Array.isArray(data) && data[0]) || data;
      if (!game?._id) {
        throw new Error("Invalid game response structure - missing game ID");
      }

      const gameId = game._id;
      console.log("[SelectCard] Valid game ID found:", gameId);

      // Start the game
      const startedGame = await gameService.startGame(gameId);
      console.log("[SelectCard] Game started response:", startedGame);

      // Handle jackpot contribution
      const jackpotContribution = parseFloat(profitData.jackpotAmount);
      if (jackpotContribution > 0) {
        try {
          const currentJackpot = await moderatorService.getJackpot();
          const newAmount = (currentJackpot?.amount || 0) + jackpotContribution;
          await moderatorService.updateJackpot(newAmount, user.id);
          console.log(`[SelectCard] Jackpot updated to ${newAmount}`);
        } catch (jackpotError) {
          console.warn(
            "[SelectCard] Jackpot update failed:",
            jackpotError.message
          );
          showAlert("Game started but jackpot update failed", "warning");
        }
      }

      showAlert("Game started successfully!", "success");

      // Clear local state
      localStorage.removeItem("selectedCards");
      setSelectedCards([]);

      // Navigate to game page
      setTimeout(() => navigate(`/bingo-game?id=${gameId}`), 1500);
    } catch (error) {
      console.error("[SelectCard] Error starting game:", {
        message: error.message,
        fullError: error,
      });

      let errorMessage = "Failed to start game";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message.includes("Invalid game response")) {
        errorMessage = "Invalid response from server - game creation failed.";
      } else if (error.message.includes("missing game ID")) {
        errorMessage = "Game ID not found in response. Server issue.";
      }

      showAlert(errorMessage, "error");
    } finally {
      setLoadingGame(false);
    }
  };

  const renderCards = () => {
    if (cardsLoading) {
      return (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="mx-auto mb-4 w-6 h-6 border-2 border-gray-600 dark:border-gray-400 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading cards...</p>
        </div>
      );
    }
    if (!cards.length) {
      return (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400">
            No cards available.
          </p>
        </div>
      );
    }
    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;
    const paginatedCards = cards.slice(startIndex, endIndex);
    const rows = [];
    for (let i = 0; i < paginatedCards.length; i += cardsPerRow) {
      const rowCards = paginatedCards.slice(i, i + cardsPerRow);
      rows.push(
        <div
          key={`row-${i}`}
          className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-10 lg:grid-cols-20 gap-2 mb-2"
        >
          {rowCards.map((card) => {
            const isSelected = selectedCards.includes(card.id);
            const isValid = validCardIds.includes(card.id);
            return (
              <div
                key={card.id}
                className={`p-2 rounded-lg shadow-sm cursor-pointer border-2 transition-all duration-200 text-center ${
                  !isValid
                    ? "bg-gray-200 dark:bg-gray-700 border-gray-400 cursor-not-allowed opacity-50"
                    : isSelected
                    ? "bg-red-100 dark:bg-red-900 border-red-500 shadow-[0_0_0_2px_rgba(229,62,62,0.3)] -translate-y-0.5"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-500"
                }`}
                onClick={() =>
                  isValid && toggleCardSelection(card.id, card.card_number)
                }
                title={!isValid ? "Card not available" : ""}
              >
                <span className="block text-lg font-extrabold text-gray-800 dark:text-gray-200">
                  {card.card_number}
                </span>
                {!isValid && (
                  <span className="text-xs text-gray-500 block">
                    Unavailable
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    return rows;
  };

  const handleClearSelection = () => {
    setSelectedCards([]);
    localStorage.removeItem("selectedCards");
    showAlert("All cards deselected", "info");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="mx-auto mb-4 w-8 h-8 border-2 border-gray-600 dark:border-gray-400 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-gray-800 dark:text-gray-200">
              Authenticating...
            </p>
          </div>
        </div>
      )}
      {alert.message && (
        <div
          className={`fixed top-4 right-4 p-4 rounded shadow-lg transition-transform duration-300 flex items-center max-w-sm z-50 transform ${
            alert.type === "success"
              ? "bg-green-100 text-green-700 border-l-4 border-green-500"
              : alert.type === "error"
              ? "bg-red-100 text-red-700 border-l-4 border-red-500"
              : alert.type === "warning"
              ? "bg-yellow-100 text-yellow-700 border-l-4 border-yellow-500"
              : "bg-blue-100 text-blue-700 border-l-4 border-blue-500"
          }`}
        >
          <div>{alert.message}</div>
        </div>
      )}
      <div className="p-6 bg-white dark:bg-gray-800 shadow-sm mb-4 mx-auto max-w-4xl rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200">
          Game Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Game Pattern
              </label>
              <select
                value={pattern}
                onChange={(e) => {
                  const newPattern = e.target.value;
                  setPattern(newPattern);
                  localStorage.setItem("gamePattern", newPattern);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading || !user}
              >
                {validPatterns.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Pattern saved and will be used for all future games
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                House Fee Percentage
              </label>
              <select
                value={housePercentage}
                onChange={(e) => {
                  const newPercentage = e.target.value;
                  setHousePercentage(newPercentage);
                  localStorage.setItem("housePercentage", newPercentage);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading || !user}
              >
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                House fee saved and will be used for all future games
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Bet Amount
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => {
                  const newBetAmount = e.target.value;
                  setBetAmount(newBetAmount);
                  localStorage.setItem("betAmount", newBetAmount);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter bet amount"
                min="1"
                step="0.01"
                disabled={loading || !user}
              />
              <p className="text-xs text-gray-500 mt-1">
                Bet amount saved and will be used for all future games. Jackpot
                will always be equal to this amount.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Selected Cards
              </label>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {selectedCards.length}
                </span>
                <span className="ml-1 text-gray-600 dark:text-gray-400">
                  cards selected
                </span>
                {selectedCards.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="ml-4 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    disabled={loading || !user}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your selections are automatically saved and restored on reload
              </p>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300 cursor-pointer"
                onClick={() => setShowProfit(!showProfit)}
              >
                Profit Calculation (click to view)
              </label>
              <div
                className={`p-3 bg-white dark:bg-gray-800 rounded transition-all duration-200 ${
                  showProfit ? "block" : "hidden"
                } text-gray-800 dark:text-gray-200`}
              >
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total Pot:</div>
                  <div className="font-bold text-right">
                    {profitData.totalPot}
                  </div>
                  <div>House Fee:</div>
                  <div className="font-bold text-right">
                    {profitData.houseFee}
                  </div>
                  <div>Prize Pool:</div>
                  <div className="font-bold text-right">
                    {profitData.prizePool}
                  </div>
                  <div>Jackpot Amount:</div>
                  <div className="font-bold text-right">
                    {profitData.jackpotAmount}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Total cards available: {validCardIds.length}</p>
              <p>
                Page {currentPage} of{" "}
                {Math.max(1, Math.ceil(cards.length / cardsPerPage))}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={handleStartGame}
            className={`bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center space-x-2 transition-all duration-200 ${
              selectedCards.length === 0 || loadingGame || loading || !user
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={
              selectedCards.length === 0 || loadingGame || loading || !user
            }
          >
            <span className={loadingGame ? "hidden" : ""}>Start Game</span>
            {loadingGame && (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
          </button>
        </div>
      </div>
      <div className="max-w-full mx-auto px-4">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
          Select Cards
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Click on cards to select them for the game. Selected cards will be
          highlighted in red. Your selections are automatically saved.
        </p>
        {cards.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Showing cards {(currentPage - 1) * cardsPerPage + 1} -{" "}
            {Math.min(currentPage * cardsPerPage, cards.length)} of{" "}
            {cards.length}
          </p>
        )}
      </div>
      <div className="p-4 max-w-full mx-auto">{renderCards()}</div>
      <div className="flex justify-center gap-4 p-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          disabled={currentPage <= 1 || cardsLoading}
        >
          Previous
        </button>
        <span className="p-2 text-gray-800 dark:text-gray-200 flex items-center">
          Page {currentPage} of{" "}
          {Math.max(1, Math.ceil(cards.length / cardsPerPage))}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(prev + 1, Math.ceil(cards.length / cardsPerPage))
            )
          }
          className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          disabled={
            currentPage >= Math.ceil(cards.length / cardsPerPage) ||
            cardsLoading
          }
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SelectCard;
