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
  const [isGameFinishedModalOpen, setIsGameFinishedModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [winningPattern, setWinningPattern] = useState("line");
  const [winningCards, setWinningCards] = useState([]);
  const [lockedCards, setLockedCards] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [callError, setCallError] = useState(null);
  const canvasRef = useRef(null);
  const autoIntervalRef = useRef(null);

  useEffect(() => {
    SoundService.preloadSounds(language);
  }, [language]);

  useEffect(() => {
    const gameId =
      searchParams.get("id") || sessionStorage.getItem("currentGameId");
    if (!gameId) {
      setCallError("No game ID found");
      setIsErrorModalOpen(true);
      return;
    }
    sessionStorage.setItem("currentGameId", gameId);

    const loadGame = async () => {
      try {
        const fetchedGame = await fetchGame(gameId);
        await fetchBingoCards(gameId);
        await updateJackpotDisplay();
      } catch (error) {
        setCallError(error.message || "Failed to load game");
        setIsErrorModalOpen(true);
        setGameData(null);
      }
    };
    loadGame();
  }, [searchParams, fetchGame]);

  useEffect(() => {
    if (game) {
      setGameData(game);
      setWinningPattern(game.pattern?.replace("_", " ") || "line");
      setCalledNumbers(game.calledNumbers || []);
      setJackpotAmount(game.potentialJackpot || 0);
      setIsGameOver(game.status === "completed");
      const cards =
        game.selectedCards?.map((card) => ({
          cardId: card.cardId,
          cardNumber: card.cardId,
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
          isWinner: game.winner?.cardId === card.cardId,
          eligibleForWin: false,
          eligibleAtNumber: null,
        })) || [];
      cards.forEach((card) => (card.markedPositions.N[2] = true));
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
  }, [
    isAutoCall,
    speed,
    isGameOver,
    gameData?._id,
    isPlaying,
    isCallingNumber,
  ]);

  const fetchBingoCards = async (gameId) => {
    if (!gameId) {
      setCallError("Invalid game ID for fetching cards");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      const cards = await gameService.getAllCards();
      const gameCards = cards.filter((card) => card.gameId === gameId);
      const formattedCards = gameCards.map((card) => ({
        cardId: card.cardId,
        cardNumber: card.cardId,
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
      setCallError(error.message || "Failed to fetch cards");
      setIsErrorModalOpen(true);
    }
  };

  const updateJackpotDisplay = async () => {
    try {
      const games = await gameService.getAllGames();
      const latestGame = games[games.length - 1];
      setJackpotAmount(latestGame?.potentialJackpot || 0);
    } catch (error) {
      setCallError(error.message || "Failed to fetch jackpot");
      setIsErrorModalOpen(true);
    }
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
      let payload = {};
      if (manualNum) {
        const num = parseInt(manualNum, 10);
        if (isNaN(num) || num < 1 || num > 75 || calledNumbers.includes(num)) {
          throw new Error("Invalid or already called number");
        }
        payload = { number: num };
      }

      const response = await callNumber(gameData._id, payload);
      const calledNumber = response.calledNumber;

      setCalledNumbers((prev) => [...prev, calledNumber]);
      setLastCalledNumbers((prev) => [calledNumber, ...prev.slice(0, 4)]);
      setCurrentNumber(calledNumber);

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
    setIsGameOver(true);
    setIsAutoCall(false);
    setIsPlaying(false);
    try {
      await finishGame(gameData._id);
      SoundService.playSound("game_finish");
      setIsGameFinishedModalOpen(true);
    } catch (error) {
      setCallError(error.message || "Failed to finish game");
      setIsErrorModalOpen(true);
    }
  };

  const handleShuffle = () => {
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
      setCallError("Invalid game ID or card ID");
      setIsErrorModalOpen(true);
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
      setCallError(error.message || "Failed to check card");
      setIsErrorModalOpen(true);
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

  return (
    <div className="w-full h-full bg-[#1a2b5f] flex flex-col items-center p-5 relative">
      <div className="flex justify-between items-center w-full max-w-[1000px]">
        <button
          className="bg-transparent border border-gray-600 text-[#f0e14a] hover:border-none w-10 h-10 rounded flex justify-center items-center text-xl cursor-pointer transition-all duration-300"
          onClick={() => navigate("/select-card")}
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
      <div className="flex flex-wrap justify-center gap-2.5 mb-5 w-full">
        <div className="text-[#f0e14a] text-3xl font-bold mr-2.5">
          GAME {gameData?.gameNumber || "Loading..."}
        </div>
        <div className="bg-[#f0e14a] text-black px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap">
          Called {calledNumbers.length}/75
        </div>
      </div>
      <div className="grid grid-cols-16 gap-1 mb-5 w-full max-w-[1000px]">
        {generateBoard()}
      </div>
      <div className="w-full flex justify-between gap-4 max-w-[1000px] max-md:flex-col">
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
              onClick={() => handleCallNumber()}
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
          <div className="flex gap-2.5 mt-2.5 w-full max-w-[1000px] justify-center">
            <input
              type="text"
              className="p-2.5 bg-[#e9a64c] border-none rounded text-base text-black w-52"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="Enter Card ID"
              disabled={!gameData?._id}
            />
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => handleCheckCard(cardId)}
              disabled={!gameData?._id || !cardId}
            >
              Check
            </button>
          </div>
          {user?.role === "moderator" && (
            <div className="flex gap-2.5 mt-2.5 w-full max-w-[1000px] justify-center">
              <input
                type="number"
                className="p-2.5 bg-[#e9a64c] border-none rounded text-base text-black w-52"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Manual Number (1-75)"
                disabled={!isPlaying || isGameOver}
                min="1"
                max="75"
              />
              <button
                className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
                onClick={handleManualCall}
                disabled={!isPlaying || isGameOver || !manualNumber}
              >
                Call Manual
              </button>
            </div>
          )}
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
        <div className="flex-1 aspect-square flex justify-center items-start">
          <p className="w-[70%] aspect-square flex justify-center items-center bg-[#f0e14a] shadow-[inset_0_0_20px_white] rounded-full text-6xl font-black text-black">
            {currentNumber || "-"}
          </p>
        </div>
      </div>
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
      {isWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Winner!</h2>
          <div className="w-60 aspect-square my-2 mx-auto">
            <canvas ref={canvasRef}></canvas>
          </div>
          <p className="mb-4 text-lg text-white">Card {winningCards[0]} won!</p>
          <button
            className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => setIsWinnerModalOpen(false)}
          >
            Close
          </button>
        </div>
      )}
      {isGameFinishedModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Game Finished!</h2>
          <p className="mb-4 text-lg text-white">
            All numbers have been called. The game is over.
          </p>
          <div className="flex gap-2.5 justify-center">
            <button
              className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => setIsGameFinishedModalOpen(false)}
            >
              Close
            </button>
            <button
              className="bg-[#e9744c] text-white border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0854c]"
              onClick={() => {
                setIsGameFinishedModalOpen(false);
                window.location.href = "/select-card";
              }}
            >
              Start New Game
            </button>
          </div>
        </div>
      )}
      {isErrorModalOpen && callError && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#e9744c] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#e9744c] mb-4 text-2xl">Error</h2>
          <p className="mb-4 text-lg text-white">{callError}</p>
          <button
            className="bg-[#e9a64c] text-black border-none px-5 py-2.5 font-bold rounded cursor-pointer text-base transition-colors duration-300 hover:bg-[#f0b76a]"
            onClick={() => {
              setIsErrorModalOpen(false);
              setCallError(null);
              if (
                callError.includes("No game ID found") ||
                callError.includes("Failed to load game")
              ) {
                window.location.href = "/create-game";
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
