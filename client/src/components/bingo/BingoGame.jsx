import React, { useState, useEffect, useRef, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LanguageContext } from "../../context/LanguageProvider";
import { useBingoGame } from "../../hooks/useBingoGame";
import gameService from "../../services/game";
import SoundService from "../../services/sound";

const BingoGame = () => {
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
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [isJackpotActive, setIsJackpotActive] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [timer, setTimer] = useState(4);
  const [manualNumber, setManualNumber] = useState("");
  const [winningPattern, setWinningPattern] = useState("line");
  const [winningCards, setWinningCards] = useState([]);
  const [lockedCards, setLockedCards] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const canvasRef = useRef(null);
  const autoIntervalRef = useRef(null);

  // Preload all audio files with SoundService
  useEffect(() => {
    SoundService.preloadSounds(language);
  }, [language]);

  // Fetch game data
  useEffect(() => {
    const gameId =
      searchParams.get("id") || sessionStorage.getItem("currentGameId");
    if (!gameId) {
      console.error("No gameId found in URL or sessionStorage");
      setGameData(null);
      return;
    }
    console.log("Fetching game with ID:", gameId);
    sessionStorage.setItem("currentGameId", gameId);

    const loadGame = async () => {
      try {
        const fetchedGame = await fetchGame(gameId);
        console.log("Fetched game:", fetchedGame);
        await fetchBingoCards(gameId);
        await updateJackpotDisplay();
      } catch (error) {
        console.error("Error fetching game data:", error.message, error);
        setGameData(null);
      }
    };
    loadGame();
  }, [searchParams]);

  // Update local states when game changes
  useEffect(() => {
    if (game) {
      setGameData(game);
      setWinningPattern(game.pattern?.replace("_", " ") || "line");
      setCalledNumbers(game.calledNumbers || []);
      setJackpotAmount(game.potentialJackpot || 0);
      setIsGameOver(game.status === "completed");
      const cards =
        game.selectedCards?.map((card) => ({
          id: card.id,
          cardNumber: card.id,
          numbers: {
            B: card.numbers.slice(0, 5).map(Number),
            I: card.numbers.slice(5, 10).map(Number),
            N: card.numbers.slice(10, 15).map(Number),
            G: card.numbers.slice(15, 20).map(Number),
            O: card.numbers.slice(20, 25).map(Number),
          },
          markedPositions: {
            B: new Array(5).fill(false),
            I: new Array(5).fill(false),
            N: new Array(5).fill(false),
            G: new Array(5).fill(false),
            O: new Array(5).fill(false),
          },
          isWinner: game.winner?.cardId === card.id,
          eligibleForWin: false,
          eligibleAtNumber: null,
        })) || [];
      cards.forEach((card) => (card.markedPositions.N[2] = true));
      setBingoCards(cards);
    }
  }, [game]);

  // Auto call logic
  useEffect(() => {
    if (isAutoCall && !isGameOver && gameData?._id && isPlaying) {
      console.log("Starting auto-call interval with gameId:", gameData._id);
      autoIntervalRef.current = setInterval(() => {
        handleCallNumber();
      }, speed * 1000);
    } else {
      console.log(
        "Clearing auto-call interval. isAutoCall:",
        isAutoCall,
        "isGameOver:",
        isGameOver,
        "gameId:",
        gameData?._id,
        "isPlaying:",
        isPlaying
      );
      clearInterval(autoIntervalRef.current);
    }
    return () => clearInterval(autoIntervalRef.current);
  }, [isAutoCall, speed, isGameOver, gameData?._id, isPlaying]);

  const fetchBingoCards = async (gameId) => {
    if (!gameId || gameId === "undefined") {
      console.error("fetchBingoCards: Invalid gameId:", gameId);
      return;
    }
    try {
      const cards = await gameService.getAllCards();
      const gameCards = cards.filter((card) => card.gameId === gameId);
      const formattedCards = gameCards.map((card) => ({
        id: card.card_number,
        cardNumber: card.card_number,
        numbers: {
          B: card.numbers.slice(0, 5).map(Number),
          I: card.numbers.slice(5, 10).map(Number),
          N: card.numbers.slice(10, 15).map(Number),
          G: card.numbers.slice(15, 20).map(Number),
          O: card.numbers.slice(20, 25).map(Number),
        },
        markedPositions: {
          B: new Array(5).fill(false),
          I: new Array(5).fill(false),
          N: new Array(5).fill(false),
          G: new Array(5).fill(false),
          O: new Array(5).fill(false),
        },
        isWinner: false,
        eligibleForWin: false,
        eligibleAtNumber: null,
      }));
      formattedCards.forEach((card) => (card.markedPositions.N[2] = true));
      setBingoCards(formattedCards);
    } catch (error) {
      console.error(
        "Error fetching cards:",
        error.response?.data || error.message
      );
    }
  };

  const updateJackpotDisplay = async () => {
    try {
      const games = await gameService.getAllGames();
      const latestGame = games[games.length - 1];
      setJackpotAmount(latestGame?.potentialJackpot || 0);
    } catch (error) {
      console.error(
        "Error fetching jackpot:",
        error.response?.data || error.message
      );
    }
  };

  const handleCallNumber = async () => {
    if (
      calledNumbers.length >= 75 ||
      isGameOver ||
      isCallingNumber ||
      !isPlaying
    ) {
      console.warn(
        "Cannot call number: game is over, number is being called, or game is paused"
      );
      return;
    }
    if (!gameData?._id) {
      console.error(
        "Cannot call number: gameId is undefined. Ensure game is loaded."
      );
      setIsAutoCall(false);
      return;
    }
    setIsCallingNumber(true);
    try {
      const response = await callNumber(gameData._id, {});
      console.log("Call number response:", response);
      const { calledNumber, game } = response;
      setCalledNumbers((prev) => [...prev, calledNumber]);
      setLastCalledNumbers((prev) => [calledNumber, ...prev.slice(0, 4)]);
      setCurrentNumber(calledNumber);
      SoundService.playSound(`number_${calledNumber}`);
      bingoCards.forEach((card) => {
        for (const letter in card.numbers) {
          const col = card.numbers[letter];
          const index = col.indexOf(calledNumber);
          if (index !== -1) {
            card.markedPositions[letter][index] = true;
          }
        }
      });
    } catch (error) {
      console.error(
        "Error calling number:",
        error.response?.data || error.message
      );
      setIsAutoCall(false);
    } finally {
      setIsCallingNumber(false);
    }
  };

  const handlePlayPause = () => {
    const willPause = isPlaying;
    setIsPlaying((prev) => !prev);
    if (!willPause) {
      setIsAutoCall(false); // Stop auto-call when pausing
    }
    const soundKey = willPause ? "game_pause" : "game_start";
    console.log(`Playing sound: ${soundKey}`);
    SoundService.playSound(soundKey);
  };

  const handleFinish = async () => {
    if (!gameData?._id) {
      console.error("Cannot finish game: gameId is undefined");
      return;
    }
    setIsGameOver(true);
    setIsAutoCall(false);
    setIsPlaying(false);
    try {
      await finishGame(gameData._id);
      SoundService.playSound("game_finish");
      console.log("Game finished successfully");
    } catch (error) {
      console.error(
        "Error finishing game:",
        error.response?.data || error.message
      );
    }
  };

  const handleShuffle = () => {
    console.log("Shuffle button clicked");
    SoundService.playSound("shuffle");
  };

  const toggleJackpot = () => {
    setIsJackpotActive((prev) => !prev);
    SoundService.playSound(
      isJackpotActive ? "jackpot_running" : "jackpot_congrats"
    );
  };

  const handleCheckCard = async (cardId) => {
    if (!gameData?._id || !cardId) {
      console.warn("Cannot check card: invalid gameId or cardId");
      return;
    }
    try {
      const response = await checkBingo(gameData._id, cardId);
      if (response.winner) {
        setIsWinnerModalOpen(true);
        setWinningCards([cardId]);
        SoundService.playSound("winner");
      } else {
        setLockedCards((prev) => [...prev, cardId]);
        SoundService.playSound("you_didnt_win");
      }
    } catch (error) {
      console.error(
        "Error checking card:",
        error.response?.data || error.message
      );
    }
  };

  const handleManualCall = async () => {
    if (!manualNumber || isGameOver || !gameData?._id || !isPlaying) {
      console.warn(
        "Cannot call manual number: invalid input, game is over, gameId is missing, or game is paused"
      );
      return;
    }
    try {
      const response = await callNumber(gameData._id, {
        number: parseInt(manualNumber),
      });
      const { calledNumber, game } = response;
      setCalledNumbers((prev) => [...prev, calledNumber]);
      setLastCalledNumbers((prev) => [calledNumber, ...prev.slice(0, 4)]);
      setCurrentNumber(calledNumber);
      SoundService.playSound(`number_${calledNumber}`);
      bingoCards.forEach((card) => {
        for (const letter in card.numbers) {
          const col = card.numbers[letter];
          const index = col.indexOf(calledNumber);
          if (index !== -1) {
            card.markedPositions[letter][index] = true;
          }
        }
      });
      setManualNumber("");
    } catch (error) {
      console.error(
        "Error calling manual number:",
        error.response?.data || error.message
      );
    }
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const generateBoard = () => {
    const board = [];
    for (let i = 1; i <= 75; i++) {
      board.push(
        <div
          key={i}
          className={`w-10 h-10 rounded flex justify-center items-center text-lg font-bold cursor-default transition-all duration-300 ${
            calledNumbers.includes(i)
              ? "bg-[#f0e14a] text-black shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]"
              : "bg-[#0f1a4a] text-[#f0e14a] border border-[#2a3969]"
          }`}
        >
          {i}
        </div>
      );
    }
    return board;
  };

  const recentNumbers = lastCalledNumbers.map((num, index) => (
    <span
      key={index}
      className="bg-[#f0e14a] text-black w-10 h-10 rounded-full flex justify-center items-center font-bold text-lg"
    >
      {num}
    </span>
  ));

  if (error) {
    return (
      <div className="text-[#f0e14a] text-center p-5">
        Error loading game: {error}
        <button
          className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base mt-4"
          onClick={() => (window.location.href = "/create-game")}
        >
          Create New Game
        </button>
      </div>
    );
  }

  if (!gameData || !gameData._id) {
    return (
      <div className="text-[#f0e14a] text-center p-5">
        {error ? `Error loading game: ${error}` : "Loading game..."}
        <button
          className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base mt-4"
          onClick={() => (window.location.href = "/create-game")}
        >
          Create New Game
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#1a2b5f] flex flex-col items-center p-5 relative">
      {/* Top Bar */}
      <div className="flex justify-between items-center w-full max-w-[1000px]">
        <button
          className="bg-transparent border border-gray-600 text-[#f0e14a] hover:border-none w-10 h-10 rounded flex justify-center items-center text-xl cursor-pointer transition-all duration-300"
          onClick={() => (window.location.href = "CashierLSelectCard.html")}
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
      {/* Title & Last Called */}
      <div className="w-full flex justify-between px-16 items-center my-12 max-[1100px]:flex-col max-[1100px]:gap-2">
        <h1 className="text-5xl font-black text-[#f0e14a] text-center">
          CLASSIC BINGO
        </h1>
        <div className="flex justify-center items-center gap-2.5">
          <span className="text-[#e9a64c] text-3xl font-bold mr-1.5">
            Last called:
          </span>
          {recentNumbers}
        </div>
      </div>
      {/* Game Info */}
      <div className="flex flex-wrap justify-center gap-2.5 mb-5 w-full">
        <div className="text-[#f0e14a] text-3xl font-bold mr-2.5">
          GAME {gameData.gameNumber}
        </div>
        <div className="bg-[#f0e14a] text-black px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap">
          Called {calledNumbers.length}/75
        </div>
      </div>
      {/* Bingo Board */}
      <div className="grid grid-cols-16 gap-1 mb-5 w-full max-w-[1000px]">
        {generateBoard()}
      </div>
      {/* Controls & Number Display */}
      <div className="w-full flex justify-between gap-4 max-w-[1000px] max-md:flex-col">
        {/* Controls */}
        <div className="flex-1">
          <div className="flex flex-wrap justify-center gap-2.5 mb-5 w-full max-w-[1000px]">
            <button
              className="bg-green-500 text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handlePlayPause}
              disabled={isGameOver}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              className="bg-[#e9744c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => setIsAutoCall((prev) => !prev)}
              disabled={!gameData?._id || !isPlaying || isGameOver}
            >
              Auto Call {isAutoCall ? "On" : "Off"}
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleCallNumber}
              disabled={
                !gameData?._id || isCallingNumber || !isPlaying || isGameOver
              }
            >
              Next
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleFinish}
              disabled={isGameOver}
            >
              Finish
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleShuffle}
              disabled={!isPlaying || isGameOver}
            >
              Shuffle
            </button>
            {user?.role === "moderator" && (
              <button
                className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
                onClick={toggleJackpot}
                disabled={isGameOver}
              >
                Jackpot {isJackpotActive ? "Off" : "On"}
              </button>
            )}
          </div>
          {/* Card ID Input */}
          <div className="flex gap-2.5 mt-2.5 w-full max-w-[1000px] justify-center">
            <input
              type="text"
              className="p-2.5 bg-[#e9a64c] border-none rounded text-base text-black w-52"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="Enter Card ID"
              disabled={!isPlaying || isGameOver}
            />
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => handleCheckCard(cardId)}
              disabled={!isPlaying || isGameOver}
            >
              Check
            </button>
          </div>
          {/* Manual Number Call */}
          {user?.role === "moderator" && (
            <div className="flex gap-2.5 mt-2.5 w-full max-w-[1000px] justify-center">
              <input
                type="number"
                className="p-2.5 bg-[#e9a64c] border-none rounded text-base text-black w-52"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Manual Number"
                disabled={!isPlaying || isGameOver}
              />
              <button
                className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
                onClick={handleManualCall}
                disabled={!isPlaying || isGameOver}
              >
                Call Manual
              </button>
            </div>
          )}

          {/* Speed Slider */}
          <div className="flex justify-center items-center gap-2.5 mt-5 mb-5">
            <span>Speed:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-24 accent-[#f0e14a]"
              disabled={!isPlaying || isGameOver}
            />
            <span>{speed}s</span>
          </div>
        </div>
        {/* Current Number Display */}
        <div className="flex-1 aspect-square flex justify-center items-start">
          <p className="w-[70%] aspect-square flex justify-center items-center bg-[#f0e14a] shadow-[inset_0_0_20px_white] rounded-full text-6xl font-black text-black">
            {currentNumber || "-"}
          </p>
        </div>
      </div>

      {/* Jackpot Display */}
      {isJackpotActive && (
        <div className="fixed bottom-5 left-[8.5%] -translate-x-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] rounded-xl p-4 text-center shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-20">
          <div className="text-3xl font-bold text-[#e9a64c] uppercase mb-2">
            JACKPOT
          </div>
          <div className="text-4xl font-bold text-[#f0e14a] mb-2.5">
            {jackpotAmount} BIRR
          </div>
          <button className="bg-[#e9744c] text-white border-none px-4 py-2.5 font-bold rounded cursor-pointer text-base transition-all duration-300 hover:bg-[#f0854c] hover:scale-105 w-full">
            Run Jackpot
          </button>
        </div>
      )}

      {/* Winner Modal */}
      {isWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Winner!</h2>
          <div className="w-60 aspect-square my-2 mx-auto">
            <canvas ref={canvasRef}></canvas>
          </div>
          <p className="mb-4 text-lg">Card won!</p>
          <button
            className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => setIsWinnerModalOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      {/* Settings Panel */}
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

      {/* Canvas for card display */}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
    </div>
  );
};

export default BingoGame;
