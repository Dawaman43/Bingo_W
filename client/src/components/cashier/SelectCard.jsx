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
    totalPot: "0.00",
    houseFee: "0.00",
    prizePool: "0.00",
    jackpotAmount: "0.00",
    currentJackpot: "0.00",
    projectedJackpot: "0.00",
  });
  const [showProfit, setShowProfit] = useState(false);
  const [validCardIds, setValidCardIds] = useState([]);
  // Keep currentJackpot state but make it secret (no UI display)
  const [currentJackpot, setCurrentJackpot] = useState(0);

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

  // Fetch current jackpot from database (kept secret)
  useEffect(() => {
    const fetchCurrentJackpot = async () => {
      if (!user || loading) {
        return;
      }

      try {
        console.log("[SelectCard] Fetching current jackpot for user:", user.id);
        // Try to get jackpot using gameService first (preferred method)
        let jackpotData;
        try {
          // Get cashierId based on user role
          let cashierId = user.id;
          if (user.role === "moderator" && user.managedCashier) {
            cashierId = user.managedCashier;
          }

          jackpotData = await gameService.getJackpot(cashierId);
          console.log(
            "[SelectCard] Jackpot data from gameService:",
            jackpotData
          );
        } catch (gameServiceError) {
          console.warn(
            "[SelectCard] gameService.getJackpot failed, trying moderatorService:",
            gameServiceError.message
          );
          // Fallback to moderatorService
          jackpotData = await moderatorService.getJackpot();
          console.log(
            "[SelectCard] Jackpot data from moderatorService:",
            jackpotData
          );
        }

        const jackpotAmount =
          jackpotData?.amount || jackpotData?.data?.amount || 0;
        setCurrentJackpot(jackpotAmount);

        console.log(
          `[SelectCard] Current jackpot loaded: ${jackpotAmount} Birr`
        );
      } catch (error) {
        console.error("[SelectCard] Failed to fetch current jackpot:", error);
        setCurrentJackpot(0);
        console.warn("[SelectCard] Using 0 as fallback jackpot amount");
      }
    };

    fetchCurrentJackpot();
  }, [user, loading]);

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
    // Save settings to localStorage whenever they change
    localStorage.setItem("betAmount", betAmount);
    localStorage.setItem("housePercentage", housePercentage);
    localStorage.setItem("gamePattern", pattern);
    calculateProfit();
  }, [betAmount, housePercentage, pattern, selectedCards, currentJackpot]);

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
        currentJackpot: currentJackpot.toFixed(2),
        projectedJackpot: currentJackpot.toFixed(2),
      });
      return;
    }

    const totalPot = bet * selectedCount;
    const jackpotAmount = bet; // Jackpot contribution is always the bet amount per game
    const remainingAmount = totalPot - jackpotAmount;
    const houseFee = (remainingAmount * percentage) / 100;
    const prizePool = remainingAmount - houseFee;
    const projectedJackpot = currentJackpot + jackpotAmount; // Current + new contribution

    setProfitData({
      totalPot: totalPot.toFixed(2),
      houseFee: houseFee.toFixed(2),
      prizePool: prizePool.toFixed(2),
      jackpotAmount: jackpotAmount.toFixed(2),
      currentJackpot: currentJackpot.toFixed(2),
      projectedJackpot: projectedJackpot.toFixed(2),
    });

    console.log("[SelectCard] Profit calculation:", {
      bet,
      selectedCount,
      totalPot,
      jackpotAmount,
      currentJackpot,
      projectedJackpot,
      houseFee,
      prizePool,
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
    console.log(
      `[SelectCard] Starting game for user: ${user.id} (${user.role})`
    );

    try {
      // Step 1: Prepare game payload
      const betAmountNum = parseFloat(betAmount);
      const housePercentageNum = parseInt(housePercentage);
      const jackpotContribution = betAmountNum; // Jackpot contribution = bet amount per game

      const payload = {
        startGameNumber: 1,
        numGames: 1,
        pattern,
        betAmount: betAmountNum,
        houseFeePercentage: housePercentageNum,
        jackpotEnabled: true,
        cardPool: selectedCards.map((id) => Number(id)),
      };

      console.log("[SelectCard] Step 1 - Creating game with payload:", {
        ...payload,
        cardPool: `${payload.cardPool.length} cards`, // Don't log all card IDs
        jackpotContribution,
      });

      // Step 2: Create the game
      const gameData = await gameService.createSequentialGames(payload);
      const game =
        gameData?.game || (Array.isArray(gameData) && gameData[0]) || gameData;

      if (!game?._id) {
        throw new Error("Invalid game response structure - missing game ID");
      }

      const gameId = game._id;
      console.log(`[SelectCard] Step 2 - Game created successfully: ${gameId}`);
      console.log(`[SelectCard] Game details:`, {
        gameNumber: game.gameNumber,
        status: game.status,
        betAmount: game.betAmount,
        selectedCardsCount: game.selectedCards?.length || 0,
      });

      // Step 3: Start the game
      console.log(`[SelectCard] Step 3 - Starting game ${gameId}`);
      const startedGame = await gameService.startGame(gameId);
      console.log("[SelectCard] Step 3 - Game started response:", {
        message: startedGame.message,
        status: startedGame.status || startedGame.game?.status,
        gameId,
      });

      // Step 4: Handle jackpot contribution (if enabled and amount > 0)
      let jackpotUpdatedSuccessfully = false;
      let finalJackpotAmount = currentJackpot;

      if (jackpotContribution > 0) {
        console.log(
          `[SelectCard] Step 4 - Processing jackpot contribution: ${jackpotContribution} Birr`
        );

        // Get correct cashierId for jackpot operations
        let cashierId = user.id;
        if (user.role === "moderator" && user.managedCashier) {
          cashierId = user.managedCashier;
          console.log(
            `[SelectCard] Moderator detected - using managed cashier: ${cashierId}`
          );
        }

        // Method 1: Primary - Use dedicated jackpot contribution endpoint
        try {
          console.log(
            `[SelectCard] Method 1 - Calling addJackpotContribution for cashier ${cashierId}`
          );
          const jackpotResponse = await gameService.addJackpotContribution(
            gameId,
            jackpotContribution
          );

          console.log("[SelectCard] Method 1 - Success:", {
            message: jackpotResponse.message,
            newTotal:
              jackpotResponse.newTotal || jackpotResponse.data?.newTotal,
            contributionAmount: jackpotResponse.contributionAmount,
          });

          // Verify the update by fetching current jackpot
          const verificationData = await gameService.getJackpot(cashierId);
          finalJackpotAmount =
            verificationData?.amount ||
            verificationData?.data?.amount ||
            currentJackpot + jackpotContribution;
          setCurrentJackpot(finalJackpotAmount);

          jackpotUpdatedSuccessfully = true;
          console.log(
            `[SelectCard] ✅ Method 1 - Jackpot verified: ${finalJackpotAmount.toFixed(
              2
            )} Birr`
          );
        } catch (method1Error) {
          console.error(
            "[SelectCard] Method 1 failed:",
            method1Error.response?.data || method1Error.message
          );

          // Method 2: Fallback - Manual jackpot update
          try {
            console.log(
              "[SelectCard] Method 2 - Trying manual jackpot update..."
            );

            // Get current jackpot amount
            const currentJackpotData = await gameService.getJackpot(cashierId);
            const currentAmount =
              currentJackpotData?.amount ||
              currentJackpotData?.data?.amount ||
              0;
            const newAmount = currentAmount + jackpotContribution;

            console.log(
              `[SelectCard] Method 2 - Current: ${currentAmount}, Adding: ${jackpotContribution}, New: ${newAmount}`
            );

            const updateResponse = await gameService.updateJackpot(newAmount);
            console.log(
              "[SelectCard] Method 2 - Update response:",
              updateResponse
            );

            // Verify the update
            const verificationData = await gameService.getJackpot(cashierId);
            finalJackpotAmount =
              verificationData?.amount ||
              verificationData?.data?.amount ||
              newAmount;
            setCurrentJackpot(finalJackpotAmount);

            jackpotUpdatedSuccessfully = true;
            console.log(
              `[SelectCard] ✅ Method 2 - Manual update successful: ${finalJackpotAmount.toFixed(
                2
              )} Birr`
            );
          } catch (method2Error) {
            console.error(
              "[SelectCard] Method 2 failed:",
              method2Error.response?.data || method2Error.message
            );

            // Method 3: Final fallback - Direct API call to backend
            try {
              console.log(
                "[SelectCard] Method 3 - Direct API call to /jackpot/contribute..."
              );

              const directResponse = await API.post(
                "/jackpot/contribute",
                {
                  contributionAmount: jackpotContribution,
                  gameId: gameId,
                  cashierId: cashierId, // Include cashierId explicitly
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                    // Include any other headers needed for auth
                  },
                }
              );

              console.log(
                "[SelectCard] Method 3 - Direct response:",
                directResponse.data
              );

              // Final verification
              const finalVerification = await gameService.getJackpot(cashierId);
              finalJackpotAmount =
                finalVerification?.amount ||
                finalVerification?.data?.amount ||
                currentJackpot + jackpotContribution;
              setCurrentJackpot(finalJackpotAmount);

              jackpotUpdatedSuccessfully = true;
              console.log(
                `[SelectCard] ✅ Method 3 - Direct API successful: ${finalJackpotAmount.toFixed(
                  2
                )} Birr`
              );
            } catch (method3Error) {
              console.error(
                "[SelectCard] Method 3 failed:",
                method3Error.response?.data || method3Error.message
              );
              console.warn(
                `[SelectCard] ❌ All jackpot update methods failed for contribution: ${jackpotContribution}`
              );
              console.warn(
                "[SelectCard] Game created successfully but jackpot not updated - manual intervention required"
              );

              // Don't throw error - game creation should still succeed
              jackpotUpdatedSuccessfully = false;
            }
          }
        }
      } else {
        console.log(
          "[SelectCard] Step 4 - Skipping jackpot (contribution <= 0)"
        );
      }

      // Step 5: Success - Clear selections and navigate
      console.log(
        `[SelectCard] Step 5 - Game setup complete! Jackpot updated: ${
          jackpotUpdatedSuccessfully ? "Yes" : "No"
        }`
      );
      console.log(
        `[SelectCard] Final jackpot amount: ${finalJackpotAmount.toFixed(
          2
        )} Birr`
      );

      // Clear local storage and state
      localStorage.removeItem("selectedCards");
      setSelectedCards([]);

      // Show success message
      const successMessage = jackpotUpdatedSuccessfully
        ? `Game started successfully!`
        : "Game started successfully! (Jackpot update pending)";

      showAlert(successMessage, "success");

      // Navigate to game after brief delay
      setTimeout(() => {
        console.log(`[SelectCard] Navigating to bingo-game?id=${gameId}`);
        navigate(`/bingo-game?id=${gameId}`);
      }, 1500);
    } catch (error) {
      console.error("[SelectCard] handleStartGame - CRITICAL ERROR:", {
        message: error.message,
        fullError: error,
        response: error.response?.data,
        status: error.response?.status,
        step: "Unknown",
      });

      let errorMessage = "Failed to start game";

      // Enhanced error message based on error type
      if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        navigate("/login");
      } else if (error.response?.status === 403) {
        errorMessage =
          "Access denied. You don't have permission to start games.";
      } else if (error.response?.status === 400) {
        errorMessage =
          error.response.data.message || "Invalid game data provided.";
      } else if (error.message.includes("Invalid game response")) {
        errorMessage = "Server returned invalid game data. Please try again.";
      } else if (error.message.includes("missing game ID")) {
        errorMessage =
          "Game created but ID not received. Server issue - contact support.";
      } else if (
        error.message.includes("Network Error") ||
        error.code === "ECONNABORTED"
      ) {
        errorMessage =
          "Network connection failed. Please check your connection and try again.";
      } else {
        errorMessage =
          error.response?.data?.message ||
          error.message ||
          "An unexpected error occurred.";
      }

      console.error(`[SelectCard] Showing error to user: ${errorMessage}`);
      showAlert(errorMessage, "error");

      // Log error for debugging
      console.error("[SelectCard] Full error details:", {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        userRole: user?.role,
        betAmount: betAmount,
        selectedCardsCount: selectedCards.length,
        error: error.response?.data || error.message,
      });
    } finally {
      // Always reset loading state
      setLoadingGame(false);
      console.log("[SelectCard] handleStartGame - Loading state reset");
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
                onChange={(e) => setPattern(e.target.value)}
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
                onChange={(e) => setHousePercentage(e.target.value)}
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
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter bet amount"
                min="1"
                step="0.01"
                disabled={loading || !user}
              />
              <p className="text-xs text-gray-500 mt-1">
                Bet amount saved and will be used for all future games. This
                amount will be added to the jackpot.
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
                    className="ml-4 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
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
                  <div>Jackpot Contribution:</div>
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
            className={`bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer ${
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
