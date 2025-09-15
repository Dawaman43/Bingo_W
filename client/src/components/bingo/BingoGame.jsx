import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LanguageContext } from "../../context/LanguageProvider";
import { useBingoGame } from "../../hooks/useBingoGame";
import gameService from "../../services/game";
import SoundService from "../../services/sound";

const BingoGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, translations, toggleLanguage } =
    useContext(LanguageContext);
  const {
    game,
    fetchGame,
    callNumber,
    checkBingo,
    selectWinner,
    finishGame,
    error,
  } = useBingoGame();
  const [searchParams] = useSearchParams();

  const [gameData, setGameData] = useState(null);
  const [bingoCards, setBingoCards] = useState([]);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [lastCalledNumbers, setLastCalledNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cardId, setCardId] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [isJackpotActive, setIsJackpotActive] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [isJackpotWinnerModalOpen, setIsJackpotWinnerModalOpen] =
    useState(false);
  const [isGameFinishedModalOpen, setIsGameFinishedModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [winningPattern, setWinningPattern] = useState("line");
  const [winningCards, setWinningCards] = useState([]);
  const [jackpotWinnerCard, setJackpotWinnerCard] = useState(null);
  const [lockedCards, setLockedCards] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const canvasRef = useRef(null);
  const autoIntervalRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    SoundService.preloadSounds(language);
  }, [language]);

  useEffect(() => {
    const gameId =
      searchParams.get("id") || sessionStorage.getItem("currentGameId");
    if (!gameId) {
      setCallError("No game ID found");
      setIsErrorModalOpen(true);
      setIsLoading(false);
      return;
    }
    sessionStorage.setItem("currentGameId", gameId);

    const loadGame = async () => {
      try {
        setIsLoading(true);
        const fetchedGame = await fetchGame(gameId);
        console.log("Fetched game data:", fetchedGame);
        setGameData(fetchedGame);
        setCalledNumbers(fetchedGame.calledNumbers || []);
        setIsJackpotActive(fetchedGame.jackpotEnabled);
        setJackpotWinnerCard(fetchedGame.jackpotWinner?.cardId || null);
        await fetchBingoCards(gameId);
        await updateJackpotDisplay();
      } catch (error) {
        setCallError(error.message || "Failed to load game");
        setIsErrorModalOpen(true);
        setGameData(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadGame();
  }, [searchParams, fetchGame]);

  useEffect(() => {
    if (game) {
      console.log("Game state updated:", game);
      setGameData(game);
      setWinningPattern(game.pattern?.replace("_", " ") || "line");
      setCalledNumbers(game.calledNumbers || []);
      setJackpotAmount(game.potentialJackpot || 0);
      setIsGameOver(game.status === "completed");
      setIsJackpotActive(game.jackpotEnabled);
      setJackpotWinnerCard(game.jackpotWinner?.cardId || null);
      const cards =
        game.selectedCards?.map((card) => ({
          cardId: card.id,
          cardNumber: card.id,
          numbers: {
            B: card.numbers
              .slice(0, 5)
              .map((n) => (n === "FREE" ? n : Number(n))),
            I: card.numbers
              .slice(5, 10)
              .map((n) => (n === "FREE" ? n : Number(n))),
            N: card.numbers
              .slice(10, 15)
              .map((n) => (n === "FREE" ? n : Number(n))),
            G: card.numbers
              .slice(15, 20)
              .map((n) => (n === "FREE" ? n : Number(n))),
            O: card.numbers
              .slice(20, 25)
              .map((n) => (n === "FREE" ? n : Number(n))),
          },
          markedPositions: {
            B: new Array(5).fill(false),
            I: new Array(5).fill(false),
            N: new Array(5).fill(false).map((_, i) => (i === 2 ? true : false)),
            G: new Array(5).fill(false),
            O: new Array(5).fill(false),
          },
          isWinner: game.winner?.cardId === card.id,
          eligibleForWin: game.moderatorWinnerCardId === card.id,
          eligibleAtNumber: null,
        })) || [];
      setBingoCards(cards);
    }
  }, [game]);

  useEffect(() => {
    if (
      isAutoCall &&
      !isGameOver &&
      gameData?._id &&
      isPlaying &&
      !isCallingNumber
    ) {
      autoIntervalRef.current = setInterval(() => {
        handleCallNumber();
      }, speed * 1000);
    } else {
      clearInterval(autoIntervalRef.current);
    }
    return () => clearInterval(autoIntervalRef.current);
  }, [isAutoCall, speed, isGameOver, isPlaying, isCallingNumber, gameData]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const fetchBingoCards = async (gameId) => {
    if (!gameId) {
      setCallError("Invalid game ID for fetching cards");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      const cards = await gameService.getAllCards();
      const gameCards =
        gameData?.selectedCards?.map((card) => ({
          cardId: card.id,
          cardNumber: card.id,
          numbers: {
            B: card.numbers
              .slice(0, 5)
              .map((n) => (n === "FREE" ? n : Number(n))),
            I: card.numbers
              .slice(5, 10)
              .map((n) => (n === "FREE" ? n : Number(n))),
            N: card.numbers
              .slice(10, 15)
              .map((n) => (n === "FREE" ? n : Number(n))),
            G: card.numbers
              .slice(15, 20)
              .map((n) => (n === "FREE" ? n : Number(n))),
            O: card.numbers
              .slice(20, 25)
              .map((n) => (n === "FREE" ? n : Number(n))),
          },
          markedPositions: {
            B: new Array(5).fill(false),
            I: new Array(5).fill(false),
            N: new Array(5).fill(false).map((_, i) => (i === 2 ? true : false)),
            G: new Array(5).fill(false),
            O: new Array(5).fill(false),
          },
          isWinner: false,
          eligibleForWin: gameData?.moderatorWinnerCardId === card.id,
          eligibleAtNumber: null,
        })) || [];
      setBingoCards(gameCards);
    } catch (error) {
      setCallError(error.message || "Failed to fetch cards");
      setIsErrorModalOpen(true);
    }
  };

  const updateJackpotDisplay = async () => {
    try {
      const jackpot = await gameService.getJackpot();
      setJackpotAmount(gameData?.jackpotEnabled ? jackpot.amount : 0);
    } catch (error) {
      setCallError(error.message || "Failed to fetch jackpot");
      setIsErrorModalOpen(true);
    }
  };

  const getNumbersForPattern = (cardNumbers, pattern) => {
    const grid = [];
    for (let i = 0; i < 5; i++)
      grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));
    const numbers = [];
    if (pattern === "single_line") {
      numbers.push(...grid[0].filter((n) => n !== "FREE"));
    } else if (pattern === "double_line") {
      numbers.push(
        ...grid[0].filter((n) => n !== "FREE"),
        ...grid[1].filter((n) => n !== "FREE")
      );
    } else if (pattern === "full_house") {
      numbers.push(...cardNumbers.filter((n) => n !== "FREE"));
    }
    return numbers.map((n) => (n === "FREE" ? n : Number(n)));
  };

  const handleCallNumber = async (manualNum = null) => {
    if (
      isGameOver ||
      isCallingNumber ||
      !isPlaying ||
      calledNumbers.length >= 75
    ) {
      if (calledNumbers.length >= 75) {
        setIsGameFinishedModalOpen(true);
        setIsAutoCall(false);
        await handleFinish();
        return;
      }
      setCallError("Cannot call number: Game is over or paused");
      setIsErrorModalOpen(true);
      return;
    }

    if (!gameData?._id) {
      setCallError("Game ID is missing");
      setIsErrorModalOpen(true);
      setIsAutoCall(false);
      return;
    }

    setIsCallingNumber(true);
    setCallError(null);

    try {
      let numberToCall;
      if (manualNum) {
        const num = parseInt(manualNum, 10);
        if (isNaN(num) || num < 1 || num > 75 || calledNumbers.includes(num)) {
          throw new Error("Invalid or already called number");
        }
        numberToCall = num;
      } else {
        const availableNumbers = Array.from(
          { length: 75 },
          (_, i) => i + 1
        ).filter((n) => !calledNumbers.includes(n));
        if (!availableNumbers.length) {
          setIsGameFinishedModalOpen(true);
          setIsAutoCall(false);
          await handleFinish();
          return;
        }

        let numberPool = availableNumbers;
        if (gameData.moderatorWinnerCardId) {
          const winningCard = gameData.selectedCards.find(
            (c) => c.id === gameData.moderatorWinnerCardId
          );
          if (winningCard) {
            const winningNumbers = getNumbersForPattern(
              winningCard.numbers,
              gameData.pattern
            ).filter((n) => !calledNumbers.includes(n));
            if (winningNumbers.length > 0) {
              numberPool = [
                ...winningNumbers,
                ...winningNumbers,
                ...availableNumbers,
              ];
            }
          }
        }

        numberToCall =
          numberPool[Math.floor(Math.random() * numberPool.length)];
      }

      const response = await callNumber(gameData._id, { number: numberToCall });
      const calledNumber = response.calledNumber || numberToCall;

      setCalledNumbers((prev) => {
        const newCalledNumbers = [...prev, calledNumber];
        console.log("Updated calledNumbers:", newCalledNumbers);
        return newCalledNumbers;
      });
      setLastCalledNumbers((prev) => [calledNumber, ...prev.slice(0, 4)]);
      setCurrentNumber(calledNumber);

      setGameData(response.game);
      SoundService.playSound(`number_${calledNumber}`);

      setBingoCards((prevCards) =>
        prevCards.map((card) => {
          const newCard = { ...card };
          for (const letter in card.numbers) {
            const col = card.numbers[letter];
            const index = col.indexOf(calledNumber);
            if (index !== -1) {
              newCard.markedPositions[letter][index] = true;
            }
          }
          return newCard;
        })
      );

      if (manualNum) setManualNumber("");
    } catch (error) {
      setCallError(error.message || "Failed to call number");
      setIsErrorModalOpen(true);
      if (
        error.message.includes("Invalid number") ||
        error.message.includes("Game is over") ||
        error.message === "All numbers already called"
      ) {
        setIsAutoCall(false);
        if (error.message === "All numbers already called") {
          setIsGameFinishedModalOpen(true);
          await handleFinish();
        }
      }
    } finally {
      setIsCallingNumber(false);
    }
  };

  const handlePlayPause = () => {
    const willPause = isPlaying;
    setIsPlaying((prev) => !prev);
    if (!willPause) {
      setIsAutoCall(false);
    }
    SoundService.playSound(willPause ? "game_pause" : "game_start");
  };

  const handleFinish = async () => {
    if (!gameData?._id) {
      setCallError("Cannot finish game: Game ID is missing");
      setIsErrorModalOpen(true);
      return;
    }
    if (gameData.status === "completed") {
      setCallError("Game is already completed");
      setIsErrorModalOpen(true);
      setIsGameOver(true);
      setIsAutoCall(false);
      setIsPlaying(false);
      setIsGameFinishedModalOpen(true);
      return;
    }
    setIsGameOver(true);
    setIsAutoCall(false);
    setIsPlaying(false);
    try {
      const response = await finishGame(gameData._id);
      setGameData(response.game);
      SoundService.playSound("game_finish");
      setIsGameFinishedModalOpen(true);
    } catch (error) {
      setCallError(error.message || "Failed to finish game");
      setIsErrorModalOpen(true);
    }
  };

  const handleStartNextGame = async () => {
    try {
      setIsLoading(true);
      const nextGame = await gameService.getNextPendingGame();
      if (!nextGame || !nextGame._id) {
        setCallError("No pending game available");
        setIsErrorModalOpen(true);
        navigate("/cashier-dashboard");
        return;
      }
      await gameService.startGame(nextGame._id);
      sessionStorage.setItem("currentGameId", nextGame._id);
      navigate(`/bingo-game?id=${nextGame._id}`);
    } catch (error) {
      setCallError(error.message || "Failed to start next game");
      setIsErrorModalOpen(true);
      navigate("/cashier-dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = () => {
    SoundService.playSound("shuffle");
  };

  const toggleJackpot = async () => {
    if (!gameData?._id) {
      setCallError("Cannot toggle jackpot: Game ID is missing");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      const newJackpotEnabled = !isJackpotActive;
      const response = await gameService.updateGame(gameData._id, {
        jackpotEnabled: newJackpotEnabled,
      });
      setIsJackpotActive(newJackpotEnabled);
      setGameData((prev) => ({ ...prev, jackpotEnabled: newJackpotEnabled }));
      setJackpotAmount(newJackpotEnabled ? response.potentialJackpot || 0 : 0);
      SoundService.playSound(
        newJackpotEnabled ? "jackpot_running" : "jackpot_congrats"
      );
    } catch (error) {
      setCallError(error.message || "Failed to toggle jackpot");
      setIsErrorModalOpen(true);
    }
  };

  const handleRunJackpot = async () => {
    if (!gameData?._id || !isJackpotActive || isGameOver) {
      setCallError("Cannot run jackpot: Game is over or jackpot is not active");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      const response = await gameService.selectJackpotWinner(gameData._id);
      setJackpotWinnerCard(response.jackpotWinner.cardId);
      setJackpotAmount(response.jackpotWinner.prize);
      setIsJackpotWinnerModalOpen(true);
      SoundService.playSound("jackpot_congrats");

      // Automatically close the jackpot winner modal after 5 seconds
      setTimeout(() => {
        setIsJackpotWinnerModalOpen(false);
        setIsJackpotActive(false); // Hide the jackpot modal
      }, 5000);
    } catch (error) {
      setCallError(error.message || "Failed to select jackpot winner");
      setIsErrorModalOpen(true);
    }
  };

  const handleCheckCard = async (cardId) => {
    if (!gameData?._id || !cardId) {
      setCallError("Invalid game ID or card ID");
      setIsErrorModalOpen(true);
      return;
    }

    const numericCardId = parseInt(cardId, 10);
    if (isNaN(numericCardId) || numericCardId < 1) {
      setCallError("Invalid card ID");
      setIsErrorModalOpen(true);
      return;
    }

    if (isGameOver || gameData.status === "completed") {
      if (
        (gameData.winner?.cardId && gameData.winner.cardId === numericCardId) ||
        (gameData.moderatorWinnerCardId &&
          gameData.moderatorWinnerCardId === numericCardId) ||
        (gameData.jackpotWinner?.cardId &&
          gameData.jackpotWinner.cardId === numericCardId)
      ) {
        setIsWinnerModalOpen(true);
        setWinningCards([numericCardId]);
        const isJackpotWin = gameData.jackpotWinner?.cardId === numericCardId;
        SoundService.playSound(isJackpotWin ? "jackpot_congrats" : "winner");
      } else {
        setCallError(
          `Card ${numericCardId} is not the winner for Game #${gameData.gameNumber}`
        );
        setIsErrorModalOpen(true);
        SoundService.playSound("you_didnt_win");
        setLockedCards((prev) => [...prev, numericCardId]);
      }
      return;
    }

    try {
      const response = await checkBingo(gameData._id, numericCardId);
      setGameData(response.game);
      if (response.winner) {
        setIsWinnerModalOpen(true);
        setWinningCards([numericCardId]);
        setIsGameOver(true);
        setIsPlaying(false);
        setIsAutoCall(false);
        SoundService.playSound("winner");
      } else {
        setLockedCards((prev) => [...prev, numericCardId]);
        setCallError(
          gameData.moderatorWinnerCardId
            ? `Card ${numericCardId} is not the selected winner`
            : `No bingo for card ${numericCardId}`
        );
        setIsErrorModalOpen(true);
        SoundService.playSound("you_didnt_win");
      }
    } catch (error) {
      setCallError(error.message || `Failed to check card ${numericCardId}`);
      setIsErrorModalOpen(true);
      SoundService.playSound("you_didnt_win");
    }
  };

  const handleManualCall = async () => {
    if (!manualNumber || isGameOver || !gameData?._id || !isPlaying) {
      setCallError("Cannot call number: Invalid input, game over, or paused");
      setIsErrorModalOpen(true);
      return;
    }
    await handleCallNumber(manualNumber);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const generateBoard = () => {
    const letters = [
      { letter: "B", color: "bg-red-600" },
      { letter: "I", color: "bg-blue-600" },
      { letter: "N", color: "bg-green-600" },
      { letter: "G", color: "bg-yellow-600" },
      { letter: "O", color: "bg-purple-600" },
    ];
    const board = [];
    for (let row = 0; row < 5; row++) {
      const rowNumbers = [];
      rowNumbers.push(
        <div
          key={`letter-${row}`}
          className={`w-12 h-12 ${letters[row].color} text-white flex justify-center items-center text-xl font-bold border border-[#2a3969]`}
        >
          {letters[row].letter}
        </div>
      );
      for (let i = row * 15 + 1; i <= (row + 1) * 15; i++) {
        rowNumbers.push(
          <div
            key={i}
            className={`w-12 h-12 rounded flex justify-center items-center text-xl font-bold cursor-default transition-all duration-300 ${
              calledNumbers.includes(i)
                ? "bg-[#f0e14a] text-black shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]"
                : "bg-[#0f1a4a] text-[#f0e14a] border border-[#2a3969]"
            }`}
          >
            {i}
          </div>
        );
      }
      board.push(
        <div key={`row-${row}`} className="flex gap-[2px]">
          {rowNumbers}
        </div>
      );
    }
    return board;
  };

  const recentNumbers = lastCalledNumbers.map((num, index) => (
    <span
      key={index}
      className="bg-[#f0e14a] text-black w-8 h-8 rounded-full flex justify-center items-center font-bold text-sm"
    >
      {num}
    </span>
  ));

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#1a2b5f] flex flex-col items-center p-5 relative"
    >
      <div className="flex justify-between items-center w-full max-w-[1200px]">
        <button
          className="bg-transparent border border-gray-600 text-[#f0e14a] hover:border-none w-10 h-10 rounded flex justify-center items-center text-xl cursor-pointer transition-all duration-300"
          onClick={() => navigate("/cashier-dashboard")}
        >
          ↩️
        </button>
        <button
          className="bg-transparent border border-gray-600 text-[#f0e14a] w-10 h-10 rounded flex justify-center items-center text-xl cursor-pointer transition-all duration-300 hover:bg-white/10 hover:scale-105"
          onClick={handleToggleFullscreen}
        >
          {isFullscreen ? "⎋" : "⛶"}
        </button>
        <button
          className="bg-transparent border border-gray-600 text-[#f0e14a] px-3 flex items-center gap-1.5 rounded cursor-pointer transition-all duration-300 hover:bg-white/10 hover:scale-105"
          onClick={toggleLanguage}
        >
          <span className="text-base">🇪🇹</span>
          <span className="text-sm">
            {translations[language]?.language || "Language"}
          </span>
        </button>
      </div>
      <div className="w-full flex justify-between px-16 items-center my-8 max-[1100px]:flex-col max-[1100px]:gap-2">
        <h1 className="text-5xl font-black text-[#f0e14a] text-center">
          JOKER BINGO
        </h1>
        <div className="flex justify-center items-center gap-2">
          <span className="text-[#e9a64c] text-2xl font-bold mr-1">
            Last called:
          </span>
          {recentNumbers}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-5 w-full">
        <div className="text-[#f0e14a] text-2xl font-bold mr-2">
          GAME {isLoading ? "Loading..." : gameData?.gameNumber || "Unknown"}
        </div>
        <div className="bg-[#f0e14a] text-black px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap">
          Called {calledNumbers.length}/75
        </div>
      </div>
      <div className="flex flex-col gap-[2px] mb-5 w-full max-w-[1200px] mr-4 flex-grow justify-center items-center">
        {generateBoard()}
      </div>
      <div className="w-full flex items-center gap-4 max-w-[1200px] max-md:flex-col">
        <div className="flex-1 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-4 w-full">
            <button
              className="bg-green-500 text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handlePlayPause}
              disabled={isGameOver}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              className="bg-[#e9744c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => setIsAutoCall((prev) => !prev)}
              disabled={!gameData?._id || !isPlaying || isGameOver}
            >
              Auto Call {isAutoCall ? "On" : "Off"}
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => handleCallNumber()}
              disabled={
                !gameData?._id || isCallingNumber || !isPlaying || isGameOver
              }
            >
              {isCallingNumber ? "Calling..." : "Next"}
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleFinish}
              disabled={isGameOver}
            >
              Finish
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleShuffle}
              disabled={!isPlaying || isGameOver}
            >
              Shuffle
            </button>
            {user?.role === "moderator" && (
              <button
                className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
                onClick={toggleJackpot}
                disabled={isGameOver}
              >
                Jackpot {isJackpotActive ? "Off" : "On"}
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2 w-full justify-center">
            <input
              type="text"
              className="p-2 bg-[#e9a64c] border-none rounded text-sm text-black w-40"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="Enter Card ID"
              disabled={!gameData?._id}
            />
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => handleCheckCard(cardId)}
              disabled={!gameData?._id || !cardId}
            >
              Check
            </button>
          </div>
          {user?.role === "moderator" && (
            <div className="flex gap-2 mt-2 w-full justify-center">
              <input
                type="number"
                className="p-2 bg-[#e9a64c] border-none rounded text-sm text-black w-40"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Manual Number (1-75)"
                disabled={!isPlaying || isGameOver}
                min="1"
                max="75"
              />
              <button
                className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
                onClick={handleManualCall}
                disabled={!isPlaying || isGameOver || !manualNumber}
              >
                Call Manual
              </button>
            </div>
          )}
          <div className="flex justify-center items-center gap-2 mt-4 mb-4">
            <span className="text-sm">Speed:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-20 accent-[#f0e14a]"
              disabled={!isPlaying || isGameOver}
            />
            <span className="text-sm">{speed}s</span>
          </div>
        </div>
        <div className="flex items-center">
          <p className="w-16 h-16 flex justify-center items-center bg-[#f0e14a] shadow-[inset_0_0_10px_white] rounded-full text-2xl font-black text-black">
            {currentNumber || "-"}
          </p>
        </div>
      </div>
      {isJackpotActive && !jackpotWinnerCard && (
        <div className="fixed bottom-5 left-[8.5%] -translate-x-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] rounded-xl p-4 text-center shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-20">
          <div className="text-2xl font-bold text-[#e9a64c] uppercase mb-2">
            JACKPOT
          </div>
          <div className="text-3xl font-bold text-[#f0e14a] mb-2">
            {jackpotAmount} BIRR
          </div>
          <button
            className="bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c] hover:scale-105 w-full"
            onClick={handleRunJackpot}
            disabled={isGameOver || !isJackpotActive || jackpotWinnerCard}
          >
            {jackpotWinnerCard ? "Jackpot Awarded" : "Run Jackpot"}
          </button>
        </div>
      )}
      {isWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">
            {gameData?.jackpotWinner?.cardId === winningCards[0]
              ? "Jackpot Winner!"
              : "Winner!"}
          </h2>
          <div className="w-60 aspect-square my-2 mx-auto">
            <canvas ref={canvasRef}></canvas>
          </div>
          <p className="mb-4 text-lg text-white">
            Game #{gameData?.gameNumber}: Card {winningCards[0]} won
            {gameData?.jackpotWinner?.cardId === winningCards[0]
              ? ` the jackpot of ${gameData.jackpotWinner.prize} BIRR!`
              : ` ${gameData?.winner?.prize || 0} BIRR!`}
          </p>
          <button
            className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => {
              setIsWinnerModalOpen(false);
              handleFinish();
            }}
          >
            Finish Game
          </button>
        </div>
      )}
      {isJackpotWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Jackpot Winner!</h2>
          <p className="mb-4 text-lg text-white">
            Game #{gameData?.gameNumber}: Card {jackpotWinnerCard} won the
            jackpot of {jackpotAmount} BIRR!
          </p>
          <button
            className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => {
              setIsJackpotWinnerModalOpen(false);
              setIsJackpotActive(false); // Hide the jackpot modal
            }}
          >
            Close
          </button>
        </div>
      )}
      {isGameFinishedModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Game Finished!</h2>
          <p className="mb-4 text-lg text-white">
            Game #{gameData?.gameNumber}: All numbers called or game ended.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => setIsGameFinishedModalOpen(false)}
            >
              Close
            </button>
            <button
              className="bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0854c]"
              onClick={handleStartNextGame}
              disabled={isLoading}
            >
              {isLoading ? "Starting..." : "Start Next Game"}
            </button>
          </div>
        </div>
      )}
      {isErrorModalOpen && callError && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#e9744c] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#e9744c] mb-4 text-2xl">Error</h2>
          <p className="mb-4 text-lg text-white">{callError}</p>
          <button
            className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => {
              setIsErrorModalOpen(false);
              setCallError(null);
              if (
                callError.includes("No game ID found") ||
                callError.includes("Failed to load game")
              ) {
                navigate("/create-game");
              }
            }}
          >
            Close
          </button>
        </div>
      )}
      {isSettingsOpen && (
        <div
          className="fixed top-0 left-0 w-[300px] h-full bg-[#0f1a4a] z-50 transition-left duration-300 overflow-y-auto shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          style={{ left: isSettingsOpen ? "0" : "-300px" }}
        >
          <div className="flex justify-between items-center p-5 border-b border-[#2a3969]">
            <div className="text-[#f0e14a] text-2xl font-bold">
              Game Settings
            </div>
            <button
              className="text-white text-2xl cursor-pointer"
              onClick={() => setIsSettingsOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsSettingsOpen(false)}
        ></div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
    </div>
  );
};

export default BingoGame;
