import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gameService from "../../services/game";
import moderatorService from "../../services/moderator"; // Added import for jackpot update
import { useAuth } from "../../context/AuthContext";

const SelectCard = () => {
  const { user } = useAuth();

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
  const [loading, setLoading] = useState(false);
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

  // Valid patterns aligned with backend
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

  // Fetch cards from backend
  useEffect(() => {
    const fetchCards = async () => {
      setCardsLoading(true);
      try {
        console.log("Fetching cards from backend...");
        const data = await gameService.getAllCards();
        console.log("Fetched cards:", data);

        if (data && Array.isArray(data) && data.length > 0) {
          const sortedCards = data
            .map((c, index) => {
              const cardId = c.cardId || c.id || c.card_number || index + 1;
              const cardNumber = c.card_number || cardId;
              return {
                id: cardId,
                card_number: cardNumber,
              };
            })
            .sort((a, b) => a.card_number - b.card_number);
          setCards(sortedCards);
          setValidCardIds(sortedCards.map((card) => card.id));
          console.log(
            "Valid card IDs:",
            sortedCards.map((card) => card.id)
          );
        } else {
          console.warn("No cards received from backend, using default cards");
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
        console.error(
          "Error fetching cards:",
          JSON.stringify(
            error.response?.data || { message: error.message },
            null,
            2
          )
        );
        const defaultCards = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          card_number: i + 1,
        }));
        setCards(defaultCards);
        setValidCardIds(defaultCards.map((card) => card.id));
        showAlert(
          "Failed to load cards from server, using default set (1-100)",
          "error"
        );
      } finally {
        setCardsLoading(false);
      }
    };
    fetchCards();
  }, []);

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

    // Total pot from all bets
    const totalPot = bet * selectedCount;
    // Jackpot is one card's bet amount if any cards are selected (matches HTML concept)
    const jackpotAmount = selectedCount > 0 ? bet : 0;
    // Remaining amount after deducting jackpot
    const remainingAmount = totalPot - jackpotAmount;
    // House fee is calculated on the remaining amount
    const houseFee = (remainingAmount * percentage) / 100;
    // Prize pool is what's left after house fee
    const prizePool = remainingAmount - houseFee;

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

    if (!bet || bet <= 0) {
      return "Please enter a valid bet amount (must be greater than 0)";
    }

    if (selectedCards.length === 0) {
      return "Please select at least one card";
    }

    if (selectedCards.length > 100) {
      return "Cannot select more than 100 cards";
    }

    if (!validPatterns.map((p) => p.value).includes(pattern)) {
      return "Please select a valid game pattern";
    }

    if (percentage < 0 || percentage > 100) {
      return "House fee percentage must be between 0 and 100";
    }

    const invalidCards = selectedCards.filter(
      (id) => !validCardIds.includes(id)
    );
    if (invalidCards.length > 0) {
      return `Invalid card IDs: ${invalidCards.join(", ")}`;
    }

    return null;
  };

  const handleStartGame = async () => {
    const validationError = validateGameData();
    if (validationError) {
      showAlert(validationError, "error");
      return;
    }
    const cashierId = user.id;

    if (!cashierId) {
      throw new Error("Missing cashierId – please log in again.");
    }
    setLoading(true);
    try {
      const payload = {
        betAmount: parseFloat(betAmount),
        houseFeePercentage: parseInt(housePercentage),
        pattern,
        selectedCards: selectedCards.map((id) => ({ id: Number(id) })),
        jackpotContribution: parseFloat(profitData.jackpotAmount),
      };

      console.log(
        "Sending payload to createGame:",
        JSON.stringify(payload, null, 2)
      );

      const response = await gameService.createGame(payload);
      console.log("Game created response:", JSON.stringify(response, null, 2));

      // Update accumulated jackpot (matches HTML concept: fetch current, add contribution, update)
      const jackpotContribution = parseFloat(profitData.jackpotAmount);
      if (jackpotContribution > 0) {
        const currentJackpot = await moderatorService.getJackpot();
        const newAmount = (currentJackpot.amount || 0) + jackpotContribution;

        // Pass cashierId explicitly
        await moderatorService.updateJackpot(newAmount, cashierId);
        console.log(`Jackpot updated to ${newAmount}`);
      }

      // Access _id directly from response (since gameService.createGame returns savedGame)
      const gameId = response._id;
      if (
        !gameId ||
        typeof gameId !== "string" ||
        !/^[0-9a-fA-F]{24}$/.test(gameId)
      ) {
        throw new Error(
          `Invalid game ID: ${gameId}. Full response: ${JSON.stringify(
            response,
            null,
            2
          )}`
        );
      }

      console.log("Starting game with ID:", gameId);
      const startedGame = await gameService.startGame(gameId);
      console.log(
        "Game started response:",
        JSON.stringify(startedGame, null, 2)
      );

      showAlert("Game started successfully!", "success");
      setTimeout(() => navigate(`/bingo-game?id=${gameId}`), 1500);
    } catch (error) {
      const errorData = error.response?.data || { message: error.message };
      console.error(
        "Full error details:",
        JSON.stringify(
          {
            message: error.message,
            status: error.response?.status,
            data: errorData,
            config: error.config,
          },
          null,
          2
        )
      );

      const errorMessage = errorData.message || "Unknown error occurred";
      const errorDetails = errorData.errors
        ? `\nDetails: ${errorData.errors.map((e) => e.msg).join(", ")}`
        : "";
      showAlert(`Error starting game: ${errorMessage}${errorDetails}`, "error");
    } finally {
      setLoading(false);
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
    showAlert("All cards deselected", "info");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
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
                  setPattern(e.target.value);
                  localStorage.setItem("gamePattern", e.target.value);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {validPatterns.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                House Fee Percentage
              </label>
              <select
                value={housePercentage}
                onChange={(e) => {
                  const value = e.target.value;
                  setHousePercentage(value);
                  localStorage.setItem("housePercentage", value);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Bet Amount
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  setBetAmount(value);
                  localStorage.setItem("betAmount", value);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter bet amount"
                min="1"
                step="0.01"
              />
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
                  >
                    Clear All
                  </button>
                )}
              </div>
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
                  <div>Jackpot Contribution:</div>{" "}
                  {/* Updated label to "Contribution" for clarity */}
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
              selectedCards.length === 0 || loading
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={selectedCards.length === 0 || loading}
          >
            <span className={loading ? "hidden" : ""}>Start Game</span>
            {loading && (
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
          highlighted in red.
        </p>
        {cards.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Showing cards {(currentPage - 1) * cardsPerPage + 1} -{" "}
            {Math.min(currentPage * cardsPerPage, cards.length)} of{" "}
            {cards.length}
          </p>
        )}
      </div>

      <div className="p-4 max-w-full mx-auto">
        {cardsLoading ? (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 w-6 h-6 border-2 border-gray-600 dark:border-gray-400 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading cards...</p>
          </div>
        ) : (
          renderCards()
        )}
      </div>

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
