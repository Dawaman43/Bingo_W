import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gameService from "../../services/game";

const SelectCard = () => {
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
    localStorage.getItem("gamePattern") || "line"
  ); // New state for pattern
  const [currentPage, setCurrentPage] = useState(1);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [profitData, setProfitData] = useState({
    totalPot: 0,
    houseFee: 0,
    prizePool: 0,
    jackpotAmount: 0,
  });
  const [showProfit, setShowProfit] = useState(false);

  const cardsPerPage = 100;
  const cardsPerRow = 20;

  // Fetch cards from backend
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      try {
        const data = await gameService.getAllCards();
        if (data && data.length > 0) {
          const sortedCards = data
            .map((c, index) => ({
              id: c.cardId || c.id || c.card_number || index + 1,
              card_number: c.card_number || index + 1,
            }))
            .sort((a, b) => a.card_number - b.card_number);
          setCards(sortedCards);
        } else {
          setCards(
            Array.from({ length: 100 }, (_, i) => ({
              id: i + 1,
              card_number: i + 1,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching cards:", error);
        setCards(
          Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            card_number: i + 1,
          }))
        );
        showAlert(
          "Failed to load cards from server, using default set",
          "error"
        );
      } finally {
        setLoading(false);
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

    const totalPot = bet * selectedCount;
    const jackpotAmount = selectedCount > 0 ? bet : 0;
    const remainingAmount = totalPot - jackpotAmount;
    const houseFee = (remainingAmount * percentage) / 100;
    const prizePool = remainingAmount - houseFee;

    setProfitData({
      totalPot: totalPot.toFixed(2),
      houseFee: houseFee.toFixed(2),
      prizePool: prizePool.toFixed(2),
      jackpotAmount: jackpotAmount.toFixed(2),
    });
  };

  const toggleCardSelection = (cardId, cardNumber) => {
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

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: "", type: "" }), 3000);
  };

  const handleStartGame = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      showAlert("Please enter a valid bet amount", "error");
      return;
    }
    if (selectedCards.length === 0) {
      showAlert("Please select at least one card", "error");
      return;
    }
    if (!["line", "diagonal", "x_pattern"].includes(pattern)) {
      showAlert("Please select a valid game pattern", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        betAmount: parseFloat(betAmount),
        houseFeePercentage: parseInt(housePercentage),
        pattern, // Include selected pattern
        selectedCards: selectedCards.map((id) => ({ id })),
      };
      console.log(
        "Sending payload to createGame:",
        JSON.stringify(payload, null, 2)
      );

      const gameData = await gameService.createGame(payload);
      const gameId = gameData._id || gameData.id || gameData.gameId;
      if (!gameId) {
        throw new Error(
          `Game ID not found in response. Response data: ${JSON.stringify(
            gameData,
            null,
            2
          )}`
        );
      }

      await gameService.startGame(gameId);
      showAlert("Game started successfully!", "success");
      setTimeout(() => navigate(`/bingo-game?id=${gameId}`), 1500);
    } catch (error) {
      console.error("Error starting game:", {
        message: error.message,
        response: error.response
          ? {
              status: error.response.status,
              data: JSON.stringify(error.response.data, null, 2),
              headers: error.response.headers,
            }
          : "No response data",
        config: error.config,
      });
      showAlert(
        `Error starting game: ${
          error.response?.data?.message || error.message || "Unknown error"
        }`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderCards = () => {
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
            return (
              <div
                key={card.id}
                className={`p-2 rounded-lg shadow-sm cursor-pointer border-2 transition-all duration-200 text-center ${
                  isSelected
                    ? "bg-red-100 dark:bg-red-900 border-red-500 shadow-[0_0_0_2px_rgba(229,62,62,0.3)] -translate-y-0.5"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}
                onClick={() => toggleCardSelection(card.id, card.card_number)}
              >
                <span className="block text-lg font-extrabold text-gray-800 dark:text-gray-200">
                  {card.card_number}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    return rows;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {alert.message && (
        <div
          className={`fixed top-4 right-4 p-4 rounded shadow-lg transition-transform duration-300 flex items-center max-w-sm z-50 transform ${
            alert.type === "success"
              ? "bg-green-100 text-green-700 border-l-4 border-green-500"
              : "bg-red-100 text-red-700 border-l-4 border-red-500"
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
                <option value="line">Line (Horizontal)</option>
                <option value="diagonal">Diagonal</option>
                <option value="x_pattern">X Pattern (Both Diagonals)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                House Fee Percentage
              </label>
              <select
                value={housePercentage}
                onChange={(e) => {
                  setHousePercentage(e.target.value);
                  localStorage.setItem("housePercentage", e.target.value);
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
                  setBetAmount(e.target.value);
                  localStorage.setItem("betAmount", e.target.value);
                }}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter bet amount"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Selected Cards
              </label>
              <div className="flex items-center">
                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {selectedCards.length}
                </span>
                <span className="ml-1 text-gray-600 dark:text-gray-400">
                  cards selected
                </span>
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
                  <div>Jackpot Amount:</div>
                  <div className="font-bold text-right">
                    {profitData.jackpotAmount}
                  </div>
                </div>
              </div>
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
          Click on cards to select them for the game.
        </p>
      </div>

      <div className="p-4 max-w-full mx-auto">
        {loading ? (
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
          className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded disabled:opacity-50"
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="p-2 text-gray-800 dark:text-gray-200">{`Page ${currentPage} of ${Math.max(
          1,
          Math.ceil(cards.length / cardsPerPage)
        )}`}</span>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(prev + 1, Math.ceil(cards.length / cardsPerPage))
            )
          }
          className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded disabled:opacity-50"
          disabled={currentPage >= Math.ceil(cards.length / cardsPerPage)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SelectCard;
