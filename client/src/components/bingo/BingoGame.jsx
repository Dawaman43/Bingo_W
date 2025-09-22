import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LanguageContext } from "../../context/LanguageProvider";
import { useBingoGame } from "../../hooks/useBingoGame";
import gameService from "../../services/game";
import moderatorService from "../../services/moderator";
import SoundService from "../../services/sound";
import io from "socket.io-client";

const BingoGame = () => {
  const [isNonWinnerModalOpen, setIsNonWinnerModalOpen] = useState(false);
  const [nonWinnerCardData, setNonWinnerCardData] = useState(null);
  const [bingoStatus, setBingoStatus] = useState(null);
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

  // Game state
  const [gameData, setGameData] = useState(null);
  const [bingoCards, setBingoCards] = useState([]);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [lastCalledNumbers, setLastCalledNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [speed, setSpeed] = useState(() => {
    // Load saved speed from localStorage or default to 8
    return parseInt(localStorage.getItem("bingoAutoCallSpeed")) || 8;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [cardId, setCardId] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [prevJackpotAmount, setPrevJackpotAmount] = useState(0);
  const [isJackpotActive, setIsJackpotActive] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [isJackpotWinnerModalOpen, setIsJackpotWinnerModalOpen] =
    useState(false);
  const [isGameFinishedModalOpen, setIsGameFinishedModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [winningPattern, setWinningPattern] = useState("line");
  const [winningCards, setWinningCards] = useState([]);
  const [jackpotWinner, setJackpotWinner] = useState({
    userId: "--",
    prize: 0,
    drawDate: "--",
  });
  const [lockedCards, setLockedCards] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jackpotCandidates, setJackpotCandidates] = useState([]);
  const [newCandidate, setNewCandidate] = useState({
    identifier: "",
    identifierType: "id",
    days: 7,
  });
  const [jackpotGrow, setJackpotGrow] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const jackpotCanvasRef = useRef(null);
  const autoIntervalRef = useRef(null);
  const containerRef = useRef(null);
  const jackpotRef = useRef(null);
  const socketRef = useRef(null);
  const p5InstanceRef = useRef(null);
  useEffect(() => {
    localStorage.setItem("bingoAutoCallSpeed", speed);
  }, [speed]);

  // Initialize Socket.IO client
  useEffect(() => {
    socketRef.current = io("https://bingo-web-9lh2.onrender.com", {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    socketRef.current.onAny((event, ...args) => {
      console.log(`Socket event received: ${event}`, args);
    });

    socketRef.current.on("jackpotAwarded", (data) => {
      console.log("Jackpot awarded event received:", data);
      if (!data.userId || !data.prize) {
        console.error("Invalid jackpot data:", data);
        setCallError("Invalid jackpot data received");
        setIsErrorModalOpen(true);
        return;
      }
      setJackpotWinner({
        userId: data.userId || "--",
        prize: data.prize || 0,
        drawDate: new Date(data.drawDate).toLocaleDateString(),
        message: data.message || "Jackpot awarded!",
      });
      setIsJackpotWinnerModalOpen(true);
      console.log("Opening jackpot winner modal");
      setIsJackpotActive(false);
      setJackpotCandidates([]);
      setJackpotAmount(100); // Set to a base amount instead of 0
      SoundService.playSound("jackpot_congrats").catch((err) => {
        console.error("Failed to play jackpot_congrats sound:", err);
        setCallError("Failed to play jackpot sound");
        setIsErrorModalOpen(true);
      });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);
  // Join cashier room when gameData is available
  useEffect(() => {
    if (gameData?.cashierId && socketRef.current.connected) {
      socketRef.current.emit("joinCashierRoom", gameData.cashierId);
      console.log(`Joined cashier room: ${gameData.cashierId}`);
    }
  }, [gameData?.cashierId]);

  useEffect(() => {
    let isMounted = true;
    SoundService.preloadSounds(language).catch((err) => {
      if (isMounted) {
        console.error("Failed to preload sounds:", err);
        setCallError("Failed to load audio files");
        setIsErrorModalOpen(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []); // Remove `language` dependency if sounds are language-agnostic
  // Load game data
  useEffect(() => {
    const gameId = searchParams.get("id");
    if (!gameId) {
      setCallError("No game ID found");
      setIsErrorModalOpen(true);
      navigate("/create-game");
      return;
    }
    setIsLoading(true);
    fetchGame(gameId)
      .then((response) => {
        setGameData(response);
        setIsLoading(false);
      })
      .catch((err) => {
        setCallError(err.message);
        setIsErrorModalOpen(true);
        setIsLoading(false);
        navigate("/create-game");
      });
  }, [searchParams, fetchGame, navigate]);

  // Initialize p5.js for jackpot animation
  useEffect(() => {
    if (isJackpotWinnerModalOpen && jackpotCanvasRef.current && p5) {
      console.log("Initializing p5.js for jackpot animation");
      const sketch = (p) => {
        let particles = [];
        let fireballs = [];
        let confetti = [];
        let sparkles = [];

        class Particle {
          constructor() {
            this.pos = p.createVector(p.random(p.width), p.random(p.height));
            this.vel = p.createVector(p.random(-3, 3), p.random(-6, -2));
            this.size = p.random(5, 15);
            this.color = p.color(
              p.random(200, 255),
              p.random(100, 255),
              p.random(100, 255)
            );
            this.alpha = 255;
          }

          update() {
            this.pos.add(this.vel);
            this.vel.y += 0.1;
            this.alpha -= 1.5;
            if (this.alpha < 0) this.alpha = 0;
          }

          display() {
            p.noStroke();
            p.fill(
              this.color.levels[0],
              this.color.levels[1],
              this.color.levels[2],
              this.alpha
            );
            p.ellipse(this.pos.x, this.pos.y, this.size);
          }

          isFinished() {
            return this.alpha <= 0 || this.pos.y > p.height;
          }
        }

        class Fireball {
          constructor() {
            const edge = p.random(0, 4);
            if (edge < 1) {
              this.pos = p.createVector(p.random(p.width), 0);
              this.vel = p.createVector(p.random(-2, 2), p.random(2, 6));
            } else if (edge < 2) {
              this.pos = p.createVector(p.width, p.random(p.height));
              this.vel = p.createVector(p.random(-6, -2), p.random(-2, 2));
            } else if (edge < 3) {
              this.pos = p.createVector(p.random(p.width), p.height);
              this.vel = p.createVector(p.random(-2, 2), p.random(-6, -2));
            } else {
              this.pos = p.createVector(0, p.random(p.height));
              this.vel = p.createVector(p.random(2, 6), p.random(-2, 2));
            }
            this.size = p.random(15, 50);
            this.color = p.color(255, p.random(100, 200), 0);
            this.alpha = 255;
          }

          update() {
            this.pos.add(this.vel);
            this.alpha -= 1.8;
            if (this.alpha < 0) this.alpha = 0;
          }

          display() {
            p.noStroke();
            p.fill(255, 150, 0, this.alpha);
            p.ellipse(this.pos.x, this.pos.y, this.size);
            p.fill(255, 200, 0, this.alpha * 0.7);
            p.ellipse(this.pos.x, this.pos.y, this.size * 0.5);
            p.fill(255, 255, 0, this.alpha * 0.3);
            p.ellipse(this.pos.x, this.pos.y, this.size * 0.3);
          }

          isFinished() {
            return (
              this.alpha <= 0 ||
              this.pos.x < -this.size ||
              this.pos.x > p.width + this.size ||
              this.pos.y < -this.size ||
              this.pos.y > p.height + this.size
            );
          }
        }

        class Confetti {
          constructor() {
            const edge = p.random(0, 4);
            if (edge < 1) {
              this.pos = p.createVector(p.random(p.width), 0);
              this.vel = p.createVector(p.random(-2, 2), p.random(2, 6));
            } else if (edge < 2) {
              this.pos = p.createVector(p.width, p.random(p.height));
              this.vel = p.createVector(p.random(-6, -2), p.random(-2, 2));
            } else if (edge < 3) {
              this.pos = p.createVector(p.random(p.width), p.height);
              this.vel = p.createVector(p.random(-2, 2), p.random(-6, -2));
            } else {
              this.pos = p.createVector(0, p.random(p.height));
              this.vel = p.createVector(p.random(2, 6), p.random(-2, 2));
            }
            this.size = p.random(5, 10);
            this.color = p.color(
              p.random(100, 255),
              p.random(100, 255),
              p.random(100, 255)
            );
            this.alpha = 255;
            this.rotation = p.random(0, p.TWO_PI);
            this.rotSpeed = p.random(-0.1, 0.1);
          }

          update() {
            this.pos.add(this.vel);
            this.alpha -= 1;
            this.rotation += this.rotSpeed;
            if (this.alpha < 0) this.alpha = 0;
          }

          display() {
            p.push();
            p.translate(this.pos.x, this.pos.y);
            p.rotate(this.rotation);
            p.noStroke();
            p.fill(
              this.color.levels[0],
              this.color.levels[1],
              this.color.levels[2],
              this.alpha
            );
            p.rect(-this.size / 2, -this.size / 2, this.size, this.size);
            p.pop();
          }

          isFinished() {
            return (
              this.alpha <= 0 ||
              this.pos.x < -this.size ||
              this.pos.x > p.width + this.size ||
              this.pos.y < -this.size ||
              this.pos.y > p.height + this.size
            );
          }
        }

        class Sparkle {
          constructor() {
            const edge = p.random(0, 4);
            if (edge < 1) {
              this.pos = p.createVector(p.random(p.width), 0);
              this.vel = p.createVector(p.random(-1, 1), p.random(1, 3));
            } else if (edge < 2) {
              this.pos = p.createVector(p.width, p.random(p.height));
              this.vel = p.createVector(p.random(-3, -1), p.random(-1, 1));
            } else if (edge < 3) {
              this.pos = p.createVector(p.random(p.width), p.height);
              this.vel = p.createVector(p.random(-1, 1), p.random(-3, -1));
            } else {
              this.pos = p.createVector(0, p.random(p.height));
              this.vel = p.createVector(p.random(1, 3), p.random(-1, 1));
            }
            this.size = p.random(3, 8);
            this.alpha = 255;
          }

          update() {
            this.pos.add(this.vel);
            this.alpha -= 2;
            if (this.alpha < 0) this.alpha = 0;
          }

          display() {
            p.noStroke();
            p.fill(255, 255, 200, this.alpha);
            p.star(this.pos.x, this.pos.y, this.size, this.size * 0.4, 5);
          }

          isFinished() {
            return (
              this.alpha <= 0 ||
              this.pos.x < -this.size ||
              this.pos.x > p.width + this.size ||
              this.pos.y < -this.size ||
              this.pos.y > p.height + this.size
            );
          }
        }

        p.star = (x, y, radius1, radius2, npoints) => {
          let angle = p.TWO_PI / npoints;
          let halfAngle = angle / 2.0;
          p.beginShape();
          for (let a = 0; a < p.TWO_PI; a += angle) {
            let sx = x + p.cos(a) * radius1;
            let sy = y + p.sin(a) * radius1;
            p.vertex(sx, sy);
            sx = x + p.cos(a + halfAngle) * radius2;
            sy = y + p.sin(a + halfAngle) * radius2;
            p.vertex(sx, sy);
          }
          p.endShape(p.CLOSE);
        };

        p.setup = () => {
          p.createCanvas(600, 600);
          console.log("p5.js canvas created: 600x600");
          for (let i = 0; i < 100; i++) {
            particles.push(new Particle());
          }
          for (let i = 0; i < 20; i++) {
            fireballs.push(new Fireball());
          }
          for (let i = 0; i < 50; i++) {
            confetti.push(new Confetti());
          }
          for (let i = 0; i < 30; i++) {
            sparkles.push(new Sparkle());
          }
        };

        p.draw = () => {
          p.clear();
          particles = particles.filter((particle) => !particle.isFinished());
          particles.forEach((particle) => {
            particle.update();
            particle.display();
          });
          fireballs = fireballs.filter((fireball) => !fireball.isFinished());
          fireballs.forEach((fireball) => {
            fireball.update();
            fireball.display();
          });
          confetti = confetti.filter((conf) => !conf.isFinished());
          confetti.forEach((conf) => {
            conf.update();
            conf.display();
          });
          sparkles = sparkles.filter((sparkle) => !sparkle.isFinished());
          sparkles.forEach((sparkle) => {
            sparkle.update();
            sparkle.display();
          });

          if (particles.length < 100) {
            particles.push(new Particle());
          }
          if (fireballs.length < 20) {
            fireballs.push(new Fireball());
          }
          if (confetti.length < 50) {
            confetti.push(new Confetti());
          }
          if (sparkles.length < 30) {
            sparkles.push(new Sparkle());
          }
        };
      };
      p5InstanceRef.current = new p5(sketch, jackpotCanvasRef.current);
    }
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        console.log("Cleaned up p5.js instance");
      }
    };
  }, [isJackpotWinnerModalOpen]);
  useEffect(() => {
    SoundService.preloadSounds(language).catch((err) => {
      console.error("Failed to preload sounds:", err);
      setCallError("Failed to load audio files. Sound may not play.");
      setIsErrorModalOpen(true);
    });
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
        console.log(
          "loadGame fetchedGame:",
          JSON.stringify(fetchedGame, null, 2)
        );
        if (!fetchedGame.gameNumber) {
          console.warn("loadGame: gameNumber is missing in fetchedGame");
        }
        setGameData(fetchedGame);
        setCalledNumbers(fetchedGame.calledNumbers || []);
        await fetchBingoCards(gameId);
        await updateJackpotDisplay();
        if (user?.role === "moderator") {
          await fetchJackpotCandidates();
          if (!fetchedGame.cashierId) {
            const pairedCashier = await moderatorService.getPairedCashier();
            setGameData((prev) => ({
              ...prev,
              cashierId: pairedCashier.data.cashierId,
            }));
          }
        }
      } catch (error) {
        console.error("loadGame error:", error.message);
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
      setGameData(game);
      setWinningPattern(game.pattern?.replace("_", " ") || "line");
      setCalledNumbers(game.calledNumbers || []);
      setIsGameOver(game.status === "completed");
    }
  }, [game]);

  // ✅ FIXED: Auto-call interval with proper number generation
  useEffect(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }

    if (
      isAutoCall &&
      !isGameOver &&
      gameData?._id &&
      isPlaying &&
      !isCallingNumber &&
      calledNumbers.length < 75 &&
      gameData?.status === "active"
    ) {
      console.log("[BingoGame] Starting auto-call interval:", speed);
      autoIntervalRef.current = setInterval(() => {
        console.log("[BingoGame] Auto-call triggered");
        handleCallNumber();
      }, speed * 1000);
    } else {
      console.log("[BingoGame] Auto-call conditions not met:", {
        isAutoCall,
        isGameOver,
        hasGameId: !!gameData?._id,
        isPlaying,
        isCallingNumber,
        numbersLeft: 75 - calledNumbers.length,
        gameStatus: gameData?.status,
      });
    }

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [
    isAutoCall,
    speed,
    isGameOver,
    isPlaying,
    isCallingNumber,
    gameData?._id,
    gameData?.status, // Add game status dependency
    calledNumbers.length,
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isGameOver && isJackpotActive) {
        await updateJackpotDisplay();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isGameOver, isJackpotActive]);

  useEffect(() => {
    if (jackpotAmount > prevJackpotAmount && prevJackpotAmount !== 0) {
      setJackpotGrow(true);
      SoundService.playSound("jackpot_running");
      setTimeout(() => setJackpotGrow(false), 2000);
    }
    setPrevJackpotAmount(jackpotAmount);
  }, [jackpotAmount, prevJackpotAmount]);

  // Helper functions
  const fetchBingoCards = async (gameId) => {
    if (!gameId) {
      setCallError("Invalid game ID for fetching cards");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      const cards = await gameService.getAllCards();
      const gameCards =
        gameData?.selectedCards?.map((card) => {
          const flatNumbers = card.numbers.map((num) =>
            num === "FREE" ? "FREE" : Number(num)
          );
          const grid = [];
          for (let row = 0; row < 5; row++) {
            grid[row] = [];
            for (let col = 0; col < 5; col++) {
              const index = row * 5 + col;
              grid[row][col] = flatNumbers[index];
            }
          }
          const markedPositions = {
            B: new Array(5).fill(false),
            I: new Array(5).fill(false),
            N: new Array(5).fill(false).map((_, i) => (i === 2 ? true : false)),
            G: new Array(5).fill(false),
            O: new Array(5).fill(false),
          };
          calledNumbers.forEach((calledNum) => {
            for (let row = 0; row < 5; row++) {
              for (let col = 0; col < 5; col++) {
                if (grid[row][col] === calledNum) {
                  const letters = ["B", "I", "N", "G", "O"];
                  const letter = letters[col];
                  markedPositions[letter][row] = true;
                }
              }
            }
          });
          return {
            cardId: card.id,
            cardNumber: card.id,
            numbers: {
              B: flatNumbers
                .slice(0, 5)
                .map((n) => (n === "FREE" ? n : Number(n))),
              I: flatNumbers
                .slice(5, 10)
                .map((n) => (n === "FREE" ? n : Number(n))),
              N: flatNumbers
                .slice(10, 15)
                .map((n) => (n === "FREE" ? n : Number(n))),
              G: flatNumbers
                .slice(15, 20)
                .map((n) => (n === "FREE" ? n : Number(n))),
              O: flatNumbers
                .slice(20, 25)
                .map((n) => (n === "FREE" ? n : Number(n))),
            },
            markedPositions,
            isWinner: false,
            eligibleForWin: gameData?.moderatorWinnerCardId === card.id,
            eligibleAtNumber: null,
          };
        }) || [];
      setBingoCards(gameCards);
    } catch (error) {
      setCallError(error.message || "Failed to fetch cards");
      setIsErrorModalOpen(true);
    }
  };

  const updateJackpotDisplay = async () => {
    try {
      const jackpot = await moderatorService.getJackpot();
      console.log("updateJackpotDisplay:", jackpot);
      setJackpotAmount(jackpot.amount || 0);
      setIsJackpotActive(jackpot.enabled ?? true);
    } catch (error) {
      setCallError(error.message || "Failed to fetch jackpot");
      setIsErrorModalOpen(true);
    }
  };

  const fetchJackpotCandidates = async () => {
    try {
      const candidates = await moderatorService.getJackpotCandidates();
      setJackpotCandidates(candidates);
    } catch (error) {
      setCallError(error.message || "Failed to fetch jackpot candidates");
      setIsErrorModalOpen(true);
    }
  };

  const handleToggleJackpot = async () => {
    try {
      const newState = !isJackpotActive;
      await moderatorService.toggleJackpot(newState);
      setIsJackpotActive(newState);
      if (newState) {
        await updateJackpotDisplay();
        await fetchJackpotCandidates();
      } else {
        setJackpotCandidates([]);
      }
    } catch (error) {
      setCallError(error.message || "Failed to toggle jackpot");
      setIsErrorModalOpen(true);
    }
  };

  const handleAddJackpotCandidate = async () => {
    if (!isJackpotActive) {
      setCallError("Jackpot is disabled");
      setIsErrorModalOpen(true);
      return;
    }
    if (!newCandidate.identifier) {
      setCallError("Please enter an identifier");
      setIsErrorModalOpen(true);
      return;
    }
    try {
      if (newCandidate.identifierType === "id") {
        if (
          !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^[0-9]+$/.test(
            newCandidate.identifier
          )
        ) {
          throw new Error(
            "Invalid ID format: Must be a valid UUID or numeric ID"
          );
        }
      } else if (newCandidate.identifierType === "phone") {
        if (!/^\+?251?[0-9]{9}$/.test(newCandidate.identifier)) {
          throw new Error(
            "Invalid phone format: Must be 9 digits, optionally starting with +251"
          );
        }
      } else if (newCandidate.identifierType === "name") {
        if (!/^[a-zA-Z0-9\s]{2,50}$/.test(newCandidate.identifier)) {
          throw new Error(
            "Invalid name format: Must be 2-50 alphanumeric characters or spaces"
          );
        }
      }
      if (![7, 14].includes(Number(newCandidate.days))) {
        throw new Error("Days must be 7 or 14");
      }
      const candidate = await moderatorService.addJackpotCandidate(
        newCandidate.identifier,
        newCandidate.identifierType,
        newCandidate.days
      );
      setJackpotCandidates((prev) => [...prev, candidate]);
      setNewCandidate({ identifier: "", identifierType: "id", days: 7 });
      setJackpotGrow(true);
      SoundService.playSound("jackpot_running");
      setTimeout(() => setJackpotGrow(false), 2000);
      await updateJackpotDisplay();
    } catch (error) {
      setCallError(error.message || "Failed to add jackpot candidate");
      setIsErrorModalOpen(true);
    }
  };

  const handleExplodeJackpot = async () => {
    if (!isJackpotActive) {
      setCallError("Jackpot is disabled");
      setIsErrorModalOpen(true);
      return;
    }
    if (!jackpotCandidates.length) {
      setCallError("No candidates available to explode jackpot");
      setIsErrorModalOpen(true);
      return;
    }
    if (!window.confirm("Are you sure you want to explode the jackpot?")) {
      return;
    }
    try {
      const winnerCandidate =
        jackpotCandidates[Math.floor(Math.random() * jackpotCandidates.length)];
      const response = await moderatorService.awardJackpot(
        gameData?._id,
        winnerCandidate.identifier,
        jackpotAmount,
        "Jackpot awarded!"
      );
      await moderatorService.setJackpotAmount(0);
      SoundService.playSound("jackpot_congrats");
    } catch (error) {
      setCallError(error.message || "Failed to explode jackpot");
      setIsErrorModalOpen(true);
    }
  };

  const getNumbersForPattern = (
    cardNumbers,
    pattern,
    calledNumbers = [],
    selectSpecificLine = false,
    targetIndices = [],
    includeMarked = false,
    lastCalledNumber = null
  ) => {
    // ✅ FIXED: More defensive input validation
    if (
      !cardNumbers ||
      (!Array.isArray(cardNumbers) && typeof cardNumbers !== "object")
    ) {
      console.warn("[BingoGame] Invalid cardNumbers:", cardNumbers);
      return {
        numbers: [],
        selectedIndices: [],
        rowIndex: null,
        colIndex: null,
        pattern,
      };
    }

    // Ensure cardNumbers is a proper 5x5 grid
    let grid = [];

    try {
      if (Array.isArray(cardNumbers) && Array.isArray(cardNumbers[0])) {
        // Already a 2D grid
        grid = cardNumbers.map((row) =>
          row.map((cell) => (cell === "FREE" ? "FREE" : Number(cell)))
        );
      } else if (Array.isArray(cardNumbers)) {
        // Flat array - convert to 2D grid
        const flatNumbers = cardNumbers.filter(
          (n) => n !== undefined && n !== null
        );
        if (flatNumbers.length >= 25) {
          for (let row = 0; row < 5; row++) {
            grid[row] = [];
            for (let col = 0; col < 5; col++) {
              const index = row * 5 + col;
              const num = flatNumbers[index];
              grid[row][col] =
                num === "FREE" || num === null ? "FREE" : Number(num);
            }
          }
        } else {
          // Not enough numbers, create empty grid
          for (let row = 0; row < 5; row++) {
            grid[row] = new Array(5).fill("FREE");
          }
        }
      } else {
        // Invalid format, create empty grid
        for (let row = 0; row < 5; row++) {
          grid[row] = new Array(5).fill("FREE");
        }
      }
    } catch (error) {
      console.error("[getNumbersForPattern] Error creating grid:", error);
      // Create empty grid as fallback
      for (let row = 0; row < 5; row++) {
        grid[row] = new Array(5).fill("FREE");
      }
    }

    let numbers = [];
    let selectedIndices = [];
    let rowIndex = null;
    let colIndex = null;

    // Ensure calledNumbers is an array
    const safeCalledNumbers = Array.isArray(calledNumbers) ? calledNumbers : [];

    // Filter logic
    const filterFn = includeMarked
      ? (n) => n !== "FREE" // Return all non-FREE numbers in pattern
      : (n) => {
          const num = Number(n);
          return (
            n !== "FREE" && !isNaN(num) && !safeCalledNumbers.includes(num)
          );
        }; // Only unmarked

    console.log(
      `[getNumbersForPattern] Processing pattern "${pattern}" with grid size: ${
        grid.length
      }x${grid[0]?.length || 0}`
    );

    try {
      // Helper function to find line containing lastCalledNumber
      const findLineContainingNumber = (lastCalledNumber, grid) => {
        if (!lastCalledNumber) return null;

        const lastCalledStr = String(lastCalledNumber);

        // Check rows first (horizontal lines)
        for (let row = 0; row < grid.length; row++) {
          for (let col = 0; col < grid[row].length; col++) {
            if (String(grid[row][col]) === lastCalledStr) {
              return { type: "row", index: row, col: col };
            }
          }
        }

        // Check columns (vertical lines)
        for (let col = 0; col < grid[0].length; col++) {
          for (let row = 0; row < grid.length; row++) {
            if (String(grid[row][col]) === lastCalledStr) {
              return { type: "col", index: col, row: row };
            }
          }
        }

        return null;
      };

      // Helper function to check if a line is complete
      const isLineComplete = (lineNumbers, calledNumbers) => {
        return lineNumbers.every((num) => {
          if (num === "FREE") return true;
          const numVal = Number(num);
          return !isNaN(numVal) && calledNumbers.includes(numVal);
        });
      };

      switch (pattern) {
        case "horizontal_line":
          let selectedRow = null;

          // Step 1: If we have lastCalledNumber, find the exact row that contains it
          if (lastCalledNumber) {
            const lineInfo = findLineContainingNumber(lastCalledNumber, grid);
            if (lineInfo && lineInfo.type === "row") {
              selectedRow = lineInfo.index;
              console.log(
                `[getNumbersForPattern] 🎯 Found lastCalledNumber ${lastCalledNumber} in row ${selectedRow}`
              );
            }
          }

          // Step 2: If no specific row found, check for complete lines
          if (!selectedRow) {
            for (let row = 0; row < grid.length; row++) {
              const rowNumbers = grid[row];
              if (isLineComplete(rowNumbers, safeCalledNumbers)) {
                selectedRow = row;
                console.log(
                  `[getNumbersForPattern] ✅ Found complete row ${row}: [${rowNumbers.join(
                    ", "
                  )}]`
                );
                break;
              }
            }
          }

          // Step 3: If still no row found, use specified target or first row as fallback
          if (
            !selectedRow &&
            selectSpecificLine &&
            Array.isArray(targetIndices) &&
            targetIndices.length > 0
          ) {
            selectedRow = Math.max(0, Math.min(4, targetIndices[0]));
            console.log(
              `[getNumbersForPattern] 📍 Using specified row ${selectedRow}`
            );
          }

          if (selectedRow === null && grid.length > 0) {
            selectedRow = 0;
            console.log(
              `[getNumbersForPattern] ⚠️ No complete/specific row found, using default row 0`
            );
          }

          // Step 4: Process the selected row
          if (
            selectedRow !== null &&
            selectedRow >= 0 &&
            selectedRow < grid.length
          ) {
            rowIndex = selectedRow;
            const rowNumbers = grid[selectedRow].filter(filterFn);
            numbers.push(...rowNumbers);
            for (let j = 0; j < 5; j++) {
              if (filterFn(grid[selectedRow][j])) {
                selectedIndices.push(selectedRow * 5 + j);
              }
            }
            console.log(
              `[getNumbersForPattern] ✅ Pattern "horizontal_line" (row ${selectedRow}) → Numbers: [${numbers.join(
                ", "
              )}], Indices: [${selectedIndices.join(", ")}]`
            );
          }
          break;

        case "vertical_line":
          let selectedCol = null;

          // Step 1: If we have lastCalledNumber, find the exact column that contains it
          if (lastCalledNumber) {
            const lineInfo = findLineContainingNumber(lastCalledNumber, grid);
            if (lineInfo && lineInfo.type === "col") {
              selectedCol = lineInfo.index;
              console.log(
                `[getNumbersForPattern] 🎯 Found lastCalledNumber ${lastCalledNumber} in column ${selectedCol}`
              );
            }
          }

          // Step 2: If no specific column found, check for complete lines
          if (!selectedCol) {
            for (let col = 0; col < grid[0].length; col++) {
              const colNumbers = [0, 1, 2, 3, 4].map((row) => grid[row][col]);
              if (isLineComplete(colNumbers, safeCalledNumbers)) {
                selectedCol = col;
                console.log(
                  `[getNumbersForPattern] ✅ Found complete column ${col}: [${colNumbers.join(
                    ", "
                  )}]`
                );
                break;
              }
            }
          }

          // Step 3: If still no column found, use specified target or first column as fallback
          if (
            !selectedCol &&
            selectSpecificLine &&
            Array.isArray(targetIndices) &&
            targetIndices.length > 0
          ) {
            selectedCol = Math.max(0, Math.min(4, targetIndices[0]));
            console.log(
              `[getNumbersForPattern] 📍 Using specified column ${selectedCol}`
            );
          }

          if (selectedCol === null && grid[0] && grid[0].length > 0) {
            selectedCol = 0;
            console.log(
              `[getNumbersForPattern] ⚠️ No complete/specific column found, using default column 0`
            );
          }

          // Step 4: Process the selected column
          if (
            selectedCol !== null &&
            selectedCol >= 0 &&
            selectedCol < grid[0].length
          ) {
            colIndex = selectedCol;
            const colNumbers = [0, 1, 2, 3, 4]
              .map((_, row) => grid[row][selectedCol])
              .filter(filterFn);
            numbers.push(...colNumbers);
            for (let i = 0; i < 5; i++) {
              if (filterFn(grid[i][selectedCol])) {
                selectedIndices.push(i * 5 + selectedCol);
              }
            }
            console.log(
              `[getNumbersForPattern] ✅ Pattern "vertical_line" (col ${selectedCol}) → Numbers: [${numbers.join(
                ", "
              )}], Indices: [${selectedIndices.join(", ")}]`
            );
          }
          break;

        case "four_corners_center":
          const cornersAndCenter = [
            grid[0][0], // top-left (B1)
            grid[0][4], // top-right (O1)
            grid[4][0], // bottom-left (B5)
            grid[4][4], // bottom-right (O5)
            grid[2][2], // center (N3)
          ].filter(filterFn);
          numbers.push(...cornersAndCenter);
          selectedIndices.push(0, 4, 20, 24, 12);
          console.log(
            `[getNumbersForPattern] ✅ Pattern "four_corners_center" → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
          break;

        case "inner_corners":
          const innerCorners = [
            grid[1][1], // I2 (index 6)
            grid[1][3], // O2 (index 8)
            grid[3][1], // I4 (index 16)
            grid[3][3], // O4 (index 18)
          ].filter(filterFn);
          numbers.push(...innerCorners);
          selectedIndices.push(6, 8, 16, 18);
          console.log(
            `[getNumbersForPattern] ✅ Pattern "inner_corners" → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
          break;

        case "main_diagonal":
          const mainDiag = [0, 1, 2, 3, 4]
            .map((i) => grid[i][i])
            .filter(filterFn);
          numbers.push(...mainDiag);
          selectedIndices.push(0, 6, 12, 18, 24);
          console.log(
            `[getNumbersForPattern] ✅ Pattern "main_diagonal" → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
          break;

        case "other_diagonal":
          const otherDiag = [0, 1, 2, 3, 4]
            .map((i) => grid[i][4 - i])
            .filter(filterFn);
          numbers.push(...otherDiag);
          selectedIndices.push(4, 8, 12, 16, 20);
          console.log(
            `[getNumbersForPattern] ✅ Pattern "other_diagonal" → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
          break;

        case "all":
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
              if (filterFn(grid[row][col])) {
                numbers.push(grid[row][col]);
                selectedIndices.push(row * 5 + col);
              }
            }
          }
          break;

        default:
          console.warn(`[getNumbersForPattern] Unknown pattern: "${pattern}"`);
          return {
            numbers: [],
            selectedIndices: [],
            rowIndex: null,
            colIndex: null,
            pattern,
          };
      }

      // ✅ FIXED: Safe filtering of numbers
      numbers = numbers
        .filter((n) => {
          if (n === null || n === undefined) return false;
          const num = Number(n);
          return !isNaN(num) && num >= 1 && num <= 75;
        })
        .map(Number);

      console.log(
        `[getNumbersForPattern] 🟢 FINAL — Pattern "${pattern}"${
          rowIndex != null
            ? ` (row ${rowIndex})`
            : colIndex != null
            ? ` (col ${colIndex})`
            : ""
        } → Numbers: [${numbers.join(", ")}], Indices: [${selectedIndices.join(
          ", "
        )}]`
      );

      return {
        numbers,
        selectedIndices,
        rowIndex,
        colIndex,
        pattern,
      };
    } catch (error) {
      console.error("[BingoGame] Error in getNumbersForPattern:", error);
      return {
        numbers: [],
        selectedIndices: [],
        rowIndex: null,
        colIndex: null,
        pattern,
      };
    }
  };

  const handleCallNumber = async (manualNum = null) => {
    console.log("[BingoGame] handleCallNumber called with:", {
      manualNum,
      isPlaying,
      isGameOver,
      gameId: gameData?._id,
      gameStatus: gameData?.status,
    });

    // Early validation for game state
    if (
      isGameOver ||
      isCallingNumber ||
      !isPlaying ||
      calledNumbers.length >= 75 ||
      gameData?.status !== "active"
    ) {
      if (calledNumbers.length >= 75) {
        console.log("[BingoGame] All numbers called - finishing game");
        setIsGameFinishedModalOpen(true);
        setIsAutoCall(false);
        await handleFinish();
        return;
      }
      console.warn("[BingoGame] Cannot call number - game state invalid:", {
        isGameOver,
        isCallingNumber,
        isPlaying,
        numbersCalled: calledNumbers.length,
        gameStatus: gameData?.status,
      });
      setCallError(
        gameData?.status !== "active"
          ? "Cannot call number: Game is paused or finished"
          : "Cannot call number: Game is over, paused, or already calling"
      );
      setIsErrorModalOpen(true);
      setIsAutoCall(false); // Stop auto-call if paused
      return;
    }

    // Validate game ID exists
    if (!gameData?._id) {
      console.error("[BingoGame] Game ID is missing:", gameData);
      setCallError("Game ID is missing");
      setIsErrorModalOpen(true);
      setIsAutoCall(false);
      return;
    }

    setIsCallingNumber(true);
    setCallError(null);

    let numberToCall;

    try {
      // Handle manual number input
      if (manualNum !== null && manualNum !== undefined && manualNum !== "") {
        console.log("[BingoGame] Manual call with number:", manualNum);
        const num = parseInt(manualNum, 10);

        // Validate manual number
        if (isNaN(num) || num < 1 || num > 75) {
          throw new Error(`Invalid manual number: ${manualNum} (must be 1-75)`);
        }

        if (calledNumbers.includes(num)) {
          throw new Error(`Number ${num} already called`);
        }

        numberToCall = num;
      }
      // Handle auto/random call
      else {
        console.log("[BingoGame] Auto/random call - generating number");

        // Generate available numbers
        const availableNumbers = Array.from(
          { length: 75 },
          (_, i) => i + 1
        ).filter((n) => !calledNumbers.includes(n));

        if (!availableNumbers.length) {
          console.log("[BingoGame] No numbers left to call");
          setIsGameFinishedModalOpen(true);
          setIsAutoCall(false);
          await handleFinish();
          return;
        }

        // Prioritize winner numbers if configured
        let numberPool = [...availableNumbers];
        if (gameData.moderatorWinnerCardId) {
          const winningCard = gameData.selectedCards?.find(
            (c) => c.id === gameData.moderatorWinnerCardId
          );
          if (winningCard) {
            // ✅ FIX: use .numbers from getNumbersForPattern
            const { numbers: patternNumbers } = getNumbersForPattern(
              winningCard.numbers.flat(),
              gameData.pattern
            );

            const winningNumbers = patternNumbers.filter(
              (num) => !calledNumbers.includes(num)
            );

            console.log(
              "[BingoGame] Winner numbers available:",
              winningNumbers
            );

            if (winningNumbers.length > 0) {
              // Bias towards winner numbers (3:1 ratio)
              numberPool = [
                ...winningNumbers,
                ...winningNumbers,
                ...winningNumbers,
                ...availableNumbers,
              ];
            }
          }
        }

        // Select random number from pool
        numberToCall =
          numberPool[Math.floor(Math.random() * numberPool.length)];

        console.log("[BingoGame] Selected number to call:", numberToCall);
      }

      // Final validation before API call
      if (
        !numberToCall ||
        isNaN(Number(numberToCall)) ||
        numberToCall < 1 ||
        numberToCall > 75
      ) {
        throw new Error(`Generated invalid number: ${numberToCall}`);
      }

      console.log(
        `[BingoGame] Calling number ${numberToCall} for game ${gameData._id}`
      );

      // Call the number via the custom hook
      const response = await callNumber(gameData._id, { number: numberToCall });

      console.log("[BingoGame] API response:", response);

      // Extract called number from response
      const calledNumber =
        response?.calledNumber ||
        numberToCall ||
        response?.game?.calledNumbers?.[
          response?.game?.calledNumbers?.length - 1
        ];

      if (!calledNumber) {
        throw new Error("No called number in response");
      }

      console.log("[BingoGame] Confirmed called number:", calledNumber);

      // Update called numbers state
      setCalledNumbers((prev) => {
        if (!prev.includes(calledNumber)) {
          return [...prev, calledNumber];
        }
        return prev;
      });

      // Update recent calls
      setLastCalledNumbers((prev) => {
        const newList = [calledNumber, ...prev.slice(0, 4)];
        return [...new Set(newList)].slice(0, 5);
      });

      // Update current number display
      setCurrentNumber(calledNumber);

      // Update game data
      setGameData(response.game);

      // Update bingo cards marking
      setBingoCards((prevCards) =>
        prevCards.map((card) => {
          const newCard = { ...card };

          // Mark the newly called number on all cards
          const letters = ["B", "I", "N", "G", "O"];
          for (let col = 0; col < 5; col++) {
            for (let row = 0; row < 5; row++) {
              const letter = letters[col];
              const number = card.numbers[letter][row];

              if (typeof number === "number" && number === calledNumber) {
                newCard.markedPositions[letter][row] = true;
              }
            }
          }

          return newCard;
        })
      );

      // Play sound effect
      SoundService.playSound(`number_${calledNumber}`);

      // Clear manual input if used
      if (manualNum) {
        setManualNumber("");
      }

      // Check for winner pattern completion
      if (response.game?.winnerPatternComplete) {
        console.log("🎉 Winner pattern completed!");
        setIsWinnerModalOpen(true);
        setWinningCards([gameData.moderatorWinnerCardId]);
        setIsGameOver(true);
        setIsPlaying(false);
        setIsAutoCall(false);
        SoundService.playSound("winner");
      }
    } catch (error) {
      console.error("[BingoGame] Detailed call error:", {
        manualNum,
        numberToCall,
        gameId: gameData?._id,
        error: error.message,
        response: error.response?.data,
        stack: error.stack,
      });

      let userMessage = "Failed to call number";

      if (error.message.includes("Invalid number")) {
        userMessage = `Invalid number: ${
          manualNum || "auto-generated"
        }. Please try again.`;
      } else if (error.message.includes("already called")) {
        userMessage = `Number ${numberToCall} already called. Skipping...`;
      } else if (
        error.message.includes("Game is not active") ||
        error.message.includes("Cannot call number: Game is")
      ) {
        userMessage = "Game is paused or finished";
        setIsPlaying(false);
        setIsAutoCall(false);
      } else if (error.response?.status === 400) {
        userMessage = error.response.data?.message || "Invalid game state";
      } else if (error.response?.status === 404) {
        userMessage = "Game not found. Please refresh.";
        navigate("/cashier-dashboard");
      }

      setCallError(userMessage);
      setIsErrorModalOpen(true);

      if (
        error.message.includes("Invalid number") ||
        error.message.includes("Game is over") ||
        error.message.includes("All numbers already called") ||
        error.message.includes("Game is not active") ||
        error.message.includes("Cannot call number: Game is")
      ) {
        setIsAutoCall(false);
        if (error.message.includes("All numbers already called")) {
          setIsGameFinishedModalOpen(true);
          await handleFinish();
        }
      }
    } finally {
      setIsCallingNumber(false);
    }
  };

  const handleNextClick = async () => {
    console.log("[BingoGame] Next button clicked - game state:", {
      isPlaying,
      isGameOver,
      isCallingNumber,
      gameId: gameData?._id,
      gameStatus: gameData?.status,
      numbersCalled: calledNumbers.length,
    });

    if (
      !isPlaying ||
      isGameOver ||
      !gameData?._id ||
      isCallingNumber ||
      gameData?.status !== "active"
    ) {
      console.warn("[BingoGame] Next button blocked by conditions");
      setCallError(
        gameData?.status !== "active"
          ? "Game is paused or finished"
          : "Cannot call number: Game is over, paused, or already calling"
      );
      setIsErrorModalOpen(true);
      return;
    }

    await handleCallNumber();
  };

  const handleManualCall = async () => {
    console.log("[BingoGame] Manual call button clicked:", {
      manualNumber,
      isPlaying,
      isGameOver,
      gameId: gameData?._id,
      gameStatus: gameData?.status,
    });

    if (
      !manualNumber ||
      isGameOver ||
      !gameData?._id ||
      !isPlaying ||
      isCallingNumber ||
      gameData?.status !== "active"
    ) {
      setCallError(
        gameData?.status !== "active"
          ? "Game is paused or finished"
          : "Cannot call number: Invalid input, game over, paused, or already calling"
      );
      setIsErrorModalOpen(true);
      return;
    }

    const cleanNumber = parseInt(manualNumber.trim(), 10);
    if (isNaN(cleanNumber) || cleanNumber < 1 || cleanNumber > 75) {
      setCallError(`Invalid manual number: ${manualNumber}. Must be 1-75.`);
      setIsErrorModalOpen(true);
      return;
    }

    if (calledNumbers.includes(cleanNumber)) {
      setCallError(`Number ${cleanNumber} already called`);
      setIsErrorModalOpen(true);
      return;
    }

    await handleCallNumber(cleanNumber);
  };
  const handlePlayPause = async () => {
    const willPause = isPlaying;
    // Play sound immediately for instant feedback
    SoundService.playSound(willPause ? "game_pause" : "game_start");
    setIsPlaying((prev) => !prev);
    setIsAutoCall(false);

    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
      console.log("[BingoGame] Auto-call interval cleared on pause/play");
    }

    if (!gameData?._id) {
      setCallError("Cannot pause/play game: Game ID is missing");
      setIsErrorModalOpen(true);
      setIsPlaying(willPause);
      return;
    }

    const newStatus = willPause ? "paused" : "active";
    if (gameData.status === newStatus) {
      console.log(`[BingoGame] Game already ${newStatus}, skipping update`);
      return;
    }

    try {
      const updatedGame = await gameService.updateGameStatus(
        gameData._id,
        newStatus
      );
      console.log(
        `[BingoGame] Game status updated to ${newStatus}`,
        updatedGame
      );
      setGameData((prev) => ({
        ...prev,
        status: newStatus,
      }));
    } catch (error) {
      if (error.response?.data?.errorCode === "STATUS_UNCHANGED") {
        console.warn(`[BingoGame] Game already ${newStatus}`);
        setGameData((prev) => ({
          ...prev,
          status: newStatus,
        }));
        return;
      }
      console.error("[BingoGame] Error updating game status:", error);
      setCallError(error.message || "Failed to update game status");
      setIsErrorModalOpen(true);
      setIsPlaying(willPause);
    }
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
      const nextGame = await moderatorService.getNextPendingGame();
      if (!nextGame || !nextGame._id) {
        setCallError("No pending game available");
        setIsErrorModalOpen(true);
        navigate("/cashier-dashboard");
        return;
      }
      await moderatorService.startGame(nextGame._id);
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

  const handleCheckCard = async (cardId) => {
    if (!gameData?._id) {
      console.error("[handleCheckCard] Invalid game ID");
      setCallError("Invalid game ID");
      setIsErrorModalOpen(true);
      return;
    }

    if (!cardId) {
      console.error("[handleCheckCard] No card selected");
      setCallError("No card selected");
      setIsErrorModalOpen(true);
      return;
    }

    const numericCardId = parseInt(cardId, 10);
    if (isNaN(numericCardId) || numericCardId < 1) {
      console.error("[handleCheckCard] Invalid card ID:", cardId);
      setCallError("Invalid card ID");
      setIsErrorModalOpen(true);
      return;
    }

    const isValidCardInGame = gameData.selectedCards?.some(
      (card) => card.id === numericCardId
    );
    if (!isValidCardInGame) {
      console.error(`[handleCheckCard] Card ${numericCardId} not in game`);
      setCallError(`Card ${numericCardId} is not playing in this game`);
      setIsErrorModalOpen(true);
      try {
        await SoundService.playSound("you_didnt_win");
      } catch (err) {
        console.error(
          "[handleCheckCard] Failed to play you_didnt_win sound:",
          err
        );
      }
      return;
    }

    try {
      const response = await checkBingo(gameData._id, numericCardId);
      console.log(
        "[handleCheckCard] checkBingo response:",
        JSON.stringify(response, null, 2)
      );

      if (response.isBingo && !response.lateCall) {
        console.log("[handleCheckCard] 🎉 BINGO DETECTED!");

        let patternNumbers, winningIndices;

        if (response.winningLineInfo) {
          patternNumbers = response.winningLineInfo;
          winningIndices = patternNumbers.selectedIndices || [];
          console.log(
            "[handleCheckCard] Using backend winningLineInfo:",
            patternNumbers
          );
        } else {
          const winningCard = gameData.selectedCards?.find(
            (card) => card.id === numericCardId
          );

          if (!winningCard || !winningCard.numbers) {
            console.error(
              "[handleCheckCard] Winning card not found in game data"
            );
            patternNumbers = {
              numbers: [],
              selectedIndices: [],
              rowIndex: null,
              colIndex: null,
              pattern: response.winningPattern,
            };
            winningIndices = [];
          } else {
            const winningCardNumbers = winningCard.numbers.flat();
            const patternResult = getNumbersForPattern(
              winningCardNumbers,
              response.winningPattern,
              response.game?.calledNumbers || [],
              true,
              [],
              true,
              response.lastCalledNumber
            );
            patternNumbers = patternResult;
            winningIndices = patternResult.selectedIndices || [];
            console.log(
              "[handleCheckCard] Using frontend pattern calculation:",
              patternResult
            );
          }
        }

        const winningNumbers = patternNumbers.numbers
          ? patternNumbers.numbers
              .filter((num) => {
                if (!num || isNaN(Number(num))) return false;
                return (response.game?.calledNumbers || []).includes(
                  Number(num)
                );
              })
              .map(Number)
          : [];

        const otherCalledNumbers = (response.game?.calledNumbers || [])
          .filter((num) => {
            if (!num || isNaN(Number(num))) return false;
            return !winningNumbers.includes(Number(num));
          })
          .map(Number);

        console.log("[handleCheckCard] Final winning data:", {
          winningPattern: response.winningPattern,
          winningNumbers,
          winningIndices,
          otherCalledNumbers,
          patternNumbers,
        });

        setBingoStatus({
          lateCall: false,
          pattern: response.winningPattern,
          winningNumbers,
          winningIndices,
          otherCalledNumbers,
          prize:
            response.winner?.prize?.toFixed(2) ||
            gameData?.prizePool?.toFixed(2) ||
            "0.00",
          winnerCardNumbers:
            response.game?.winnerCardNumbers || winningCard?.numbers || [],
          patternInfo: patternNumbers,
        });

        setGameData((prev) => ({
          ...prev,
          winnerPatternComplete: true,
          status: "completed",
          winnerCardNumbers:
            response.game?.winnerCardNumbers || winningCard?.numbers || [],
          selectedWinnerNumbers: response.game?.selectedWinnerNumbers || [],
          lastCalledNumbers: [response.lastCalledNumber],
        }));
        setIsWinnerModalOpen(true);
        setIsGameOver(true);
        setIsPlaying(false);
        setIsAutoCall(false);

        try {
          await SoundService.playSound("winner");
          console.log("[handleCheckCard] Played winner sound");
        } catch (err) {
          console.error("[handleCheckCard] Failed to play winner sound:", err);
        }
      } else {
        // Handle non-winning cases (including late calls)
        const card = gameData.selectedCards?.find(
          (c) => c.id === numericCardId
        );
        if (!card || !card.numbers) {
          console.error("[handleCheckCard] Card data not found");
          setCallError("Card data not found");
          setIsErrorModalOpen(true);
          return;
        }

        const cardNumbers = card.numbers.flat();
        const patternResult = getNumbersForPattern(
          cardNumbers,
          response.winningPattern || gameData.pattern,
          response.game?.calledNumbers || calledNumbers,
          true,
          [],
          true,
          response.lastCalledNumber
        );

        const calledNumbersInPattern = patternResult.numbers
          .filter((num) => {
            if (!num || isNaN(Number(num))) return false;
            return (response.game?.calledNumbers || calledNumbers).includes(
              Number(num)
            );
          })
          .map(Number);

        const otherCalledNumbers = (
          response.game?.calledNumbers || calledNumbers
        )
          .filter((num) => {
            if (!num || isNaN(Number(num))) return false;
            return !calledNumbersInPattern.includes(Number(num));
          })
          .map(Number);

        setNonWinnerCardData({
          cardId: numericCardId,
          cardNumbers: card.numbers,
          pattern: response.winningPattern || gameData.pattern,
          patternInfo: patternResult,
          calledNumbersInPattern,
          otherCalledNumbers,
          lateCall: response.lateCall || false,
          lateCallMessage:
            response.lateCallMessage || "This card missed its chance!",
          wouldHaveWon: response.wouldHaveWon || null,
        });

        setIsNonWinnerModalOpen(true);
        setLockedCards((prev) => [...new Set([...prev, numericCardId])]);

        try {
          await SoundService.playSound(
            response.lateCall ? "late_call" : "you_didnt_win"
          );
        } catch (err) {
          console.error("[handleCheckCard] Failed to play sound:", err);
        }
      }
    } catch (error) {
      let userFriendlyMessage =
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred";
      console.error("[handleCheckCard] Error:", {
        message: userFriendlyMessage,
        error,
        response: error.response?.data,
        cardId,
        numericCardId,
      });

      if (
        userFriendlyMessage.includes("Card not in game") ||
        userFriendlyMessage.includes("Card not found")
      ) {
        userFriendlyMessage = `Card ${cardId} not found in game #${
          gameData?.gameNumber || "unknown"
        }`;
      }

      setCallError(userFriendlyMessage);
      setIsErrorModalOpen(true);
      try {
        await SoundService.playSound("you_didnt_win");
      } catch (err) {
        console.error(
          "[handleCheckCard] Failed to play you_didnt_win sound on error:",
          err
        );
      }
    }
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

  // UI Generation
  const generateBoard = () => {
    const letters = [
      { letter: "B", color: "bg-[#e9a64c]" },
      { letter: "I", color: "bg-[#e9a64c]" },
      { letter: "N", color: "bg-[#e9a64c]" },
      { letter: "G", color: "bg-[#e9a64c]" },
      { letter: "O", color: "bg-[#e9a64c]" },
    ];
    const board = [];
    for (let row = 0; row < 5; row++) {
      const rowNumbers = [];
      rowNumbers.push(
        <div
          key={`letter-${row}`}
          className={`w-14 h-14 ${letters[row].color} text-black flex justify-center items-center text-2xl font-bold border border-[#2a3969]`}
        >
          {letters[row].letter}
        </div>
      );
      for (let i = row * 15 + 1; i <= (row + 1) * 15; i++) {
        rowNumbers.push(
          <div
            key={i}
            className={`w-14 h-14 flex justify-center items-center text-xl font-bold cursor-default transition-all duration-300 ${
              calledNumbers.includes(i)
                ? "bg-[#0a1174] text-white border border-[#2a3969]"
                : "bg-[#e02d2d] text-white border border-[#2a3969]"
            }`}
          >
            {i}
          </div>
        );
      }
      board.push(
        <div key={`row-${row}`} className="flex gap-[5px]">
          {rowNumbers}
        </div>
      );
    }
    return board;
  };

  const recentNumbers = lastCalledNumbers.map((num, index) => (
    <div
      key={index}
      className={`w-11 h-11 flex justify-center items-center font-bold text-lg rounded-full ${
        index === 0
          ? "bg-[#d20000]"
          : index === 1
          ? "bg-[rgba(210,0,0,0.8)]"
          : index === 2
          ? "bg-[rgba(210,0,0,0.6)]"
          : index === 3
          ? "bg-[rgba(210,0,0,0.4)]"
          : "bg-[rgba(210,0,0,0.2)]"
      } text-white`}
    >
      {num || "-"}
    </div>
  ));

  // ✅ FIXED: Button click handlers
  const handleNextButtonClick = async () => {
    console.log("[BingoGame] Next button clicked");
    await handleNextClick();
  };

  const handleManualCallButtonClick = async () => {
    console.log("[BingoGame] Manual call button clicked");
    await handleManualCall();
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0a1235] flex flex-col items-center p-5 relative"
    >
      {/* Navigation Header */}
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
          <span className="text-base">🇬🇧</span>
          <span className="text-sm">
            {translations[language]?.language || "Language"}
          </span>
        </button>
      </div>
      {/* Title and Recent Numbers */}
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
      {/* Game Info */}
      <div className="flex flex-wrap justify-center gap-2 mb-5 w-full">
        <div className="text-[#f0e14a] text-2xl font-bold mr-2">
          GAME {isLoading ? "Loading..." : gameData?.gameNumber || "Unknown"}
        </div>
        <div className="bg-[#f0e14a] text-black px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap">
          Called {calledNumbers.length}/75
        </div>
      </div>
      {/* Bingo Board */}
      <div className="flex flex-col gap-[5px] mb-5 w-full max-w-[1200px] flex-grow justify-center items-center">
        {generateBoard()}
      </div>
      {/* Controls and Last Number */}
      <div className="w-full flex items-center gap-4 max-w-[1200px] max-md:flex-col">
        <div className="flex-1 flex flex-col items-center">
          {/* Control Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-4 w-full">
            <button
              className={`bg-[#4caf50] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a] ${
                isPlaying ? "bg-[#e9744c]" : ""
              }`}
              onClick={handlePlayPause}
              disabled={isGameOver}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              className={`bg-[#e9744c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a] ${
                isAutoCall ? "bg-[#4caf50]" : ""
              }`}
              onClick={() => setIsAutoCall((prev) => !prev)}
              disabled={!gameData?._id || !isPlaying || isGameOver}
            >
              Auto Call {isAutoCall ? "On" : "Off"}
            </button>
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={handleNextButtonClick} // ✅ Fixed: Use the handler
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
          </div>

          {/* Card Check Input */}
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
              disabled={!gameData?._id}
            >
              Check
            </button>
          </div>

          {/* Moderator Controls */}
          {user?.role === "moderator" && (
            <div className="flex flex-col gap-4 mt-4 w-full max-w-md">
              <div className="flex gap-2 justify-center">
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
                  onClick={handleManualCallButtonClick} // ✅ Fixed: Use the handler
                  disabled={
                    !isPlaying || isGameOver || !manualNumber || isCallingNumber
                  }
                >
                  Call Manual
                </button>
              </div>
              {/* Jackpot Controls */}
              <div className="flex flex-col gap-2 bg-[#0f1a4a] p-4 rounded-lg">
                <h3 className="text-[#f0e14a] text-lg font-bold">
                  Jackpot Controls
                </h3>
                <button
                  className={`bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c] ${
                    isJackpotActive ? "bg-[#4caf50]" : ""
                  }`}
                  onClick={handleToggleJackpot}
                >
                  Jackpot {isJackpotActive ? "On" : "Off"}
                </button>
                <input
                  type="text"
                  className="p-2 bg-[#e9a64c] border-none rounded text-sm text-black"
                  value={newCandidate.identifier}
                  onChange={(e) =>
                    setNewCandidate({
                      ...newCandidate,
                      identifier: e.target.value,
                    })
                  }
                  placeholder="ID, Name, or Phone"
                  disabled={!isJackpotActive}
                />
                <select
                  className="p-2 bg-[#e9a64c] border-none rounded text-sm text-black"
                  value={newCandidate.identifierType}
                  onChange={(e) =>
                    setNewCandidate({
                      ...newCandidate,
                      identifierType: e.target.value,
                    })
                  }
                  disabled={!isJackpotActive}
                >
                  <option value="id">ID</option>
                  <option value="name">Name</option>
                  <option value="phone">Phone</option>
                </select>
                <select
                  className="p-2 bg-[#e9a64c] border-none rounded text-sm text-black"
                  value={newCandidate.days}
                  onChange={(e) =>
                    setNewCandidate({
                      ...newCandidate,
                      days: Number(e.target.value),
                    })
                  }
                  disabled={!isJackpotActive}
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                </select>
                <button
                  className="bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c]"
                  onClick={handleAddJackpotCandidate}
                  disabled={!isJackpotActive || !newCandidate.identifier}
                >
                  Add Candidate
                </button>
                <button
                  className="bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c]"
                  onClick={fetchJackpotCandidates}
                  disabled={!isJackpotActive}
                >
                  Refresh Candidates
                </button>
                <button
                  className={`bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c] ${
                    !jackpotCandidates.length
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  onClick={handleExplodeJackpot}
                  disabled={!jackpotCandidates.length}
                >
                  Run Jackpot
                </button>
              </div>
            </div>
          )}

          {/* Speed Control */}
          <div className="flex justify-center items-center gap-2 mt-4 mb-4">
            <span className="text-sm">🕒</span>
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

        {/* Last Number Container */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <p className="w-36 h-36 flex justify-center items-center bg-[#f0e14a] shadow-[inset_0_0_10px_white] rounded-full text-6xl font-black text-black">
              {currentNumber || "-"}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[#f0e14a] text-sm font-bold mb-1">Prize Pool</p>
            <p className="w-26 h-26 flex justify-center items-center bg-[#e9744c] shadow-[inset_0_0_10px_white] rounded-full text-2xl font-black text-white">
              {gameData?.prizePool?.toFixed(2) || 0}
            </p>
          </div>
        </div>
      </div>
      {/* Jackpot Display */}
      {isJackpotActive && (
        <div
          ref={jackpotRef}
          className={`fixed bottom-5 left-5 bg-[#0f1a4a] border-4 border-[#f0e14a] rounded-xl p-4 text-center shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-50 min-w-[250px] transition-transform duration-1000 ${
            jackpotGrow ? "scale-150 animate-pulse" : "scale-100"
          }`}
        >
          <div className="text-2xl font-bold text-[#e9a64c] uppercase mb-2">
            JACKPOT
          </div>
          <div className="text-3xl font-bold text-[#f0e14a] mb-2">
            {isLoading ? "Loading..." : jackpotAmount.toFixed(2)} BIRR
          </div>
          <div className="text-sm text-white mb-1">
            Winner ID: {jackpotWinner.userId}
          </div>
          <div className="text-sm text-white mb-1">
            Prize: {jackpotWinner.prize.toFixed(2)} BIRR
          </div>
          <div className="text-sm text-white mb-2">
            Draw Date: {jackpotWinner.drawDate}
          </div>
          {user?.role === "moderator" && (
            <button
              className={`bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c] hover:scale-105 w-full ${
                !jackpotCandidates.length ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={handleExplodeJackpot}
              disabled={!jackpotCandidates.length}
            >
              Run Jackpot
            </button>
          )}
          {user?.role === "moderator" && jackpotCandidates.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-[#f0e14a] font-bold mb-1">
                Active Candidates
              </div>
              <ul className="text-sm text-white max-h-32 overflow-y-auto">
                {jackpotCandidates.map((candidate) => (
                  <li key={candidate._id} className="mb-1">
                    {candidate.identifier} ({candidate.identifierType}, Expires:{" "}
                    {new Date(candidate.expiryDate).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-4 rounded-xl z-50 text-center min-w-[320px] max-w-[380px] max-h-[90vh] overflow-y-auto shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          {bingoStatus?.lateCall ? (
            <div className="space-y-3">
              <div className="text-2xl mb-3 flex items-center justify-center gap-2">
                <span className="text-yellow-400">🕒</span>
                <span className="text-yellow-400 font-bold">LATE CALL!</span>
              </div>
              <div className="bg-yellow-900/50 border border-yellow-400 p-3 rounded-lg">
                <h3 className="text-yellow-200 text-base font-semibold mb-2">
                  You Missed Your Chance! ⏰
                </h3>
                <p className="text-yellow-100 text-sm mb-2">
                  {bingoStatus.lateCallMessage ||
                    "You missed your chance to claim the win!"}
                </p>
                {bingoStatus.wouldHaveWon && (
                  <div className="text-xs text-yellow-200 space-y-1">
                    <p>
                      <strong>Would have won with:</strong>{" "}
                      {bingoStatus.wouldHaveWon.pattern?.replace("_", " ") ||
                        "unknown"}
                    </p>
                    <p>
                      <strong>On call:</strong> #
                      {bingoStatus.wouldHaveWon.callIndex}
                    </p>
                    <p>
                      <strong>With number:</strong>{" "}
                      {bingoStatus.wouldHaveWon.completingNumber}
                    </p>
                    <p className="text-yellow-300">
                      <strong>Prize:</strong> {gameData?.prizePool?.toFixed(2)}{" "}
                      BIRR
                    </p>
                  </div>
                )}
              </div>
              <button
                className="bg-yellow-600 text-white border-none px-6 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-yellow-500 w-full"
                onClick={() => {
                  setIsWinnerModalOpen(false);
                  setBingoStatus(null);
                  setCallError(null);
                  console.log("[BingoWinnerModal] Closed late call modal");
                }}
              >
                I Understand
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[#f0e14a] mb-3 text-xl flex items-center justify-center gap-2">
                <span className="text-2xl">🎉</span>
                <span>WINNER!</span>
              </h2>
              <p className="text-white text-base">
                Card <span className="text-[#f0e14a] font-bold">{cardId}</span>{" "}
                won with{" "}
                <span className="text-green-400 font-bold">
                  {bingoStatus?.pattern?.replace("_", " ") || "unknown"}
                </span>
                !
              </p>

              {/* Full Bingo Card Display with B I N G O Headers */}
              {(bingoStatus?.winnerCardNumbers || bingoStatus?.patternInfo) && (
                <div className="mt-3">
                  <h3 className="text-white text-base font-semibold mb-2 flex items-center justify-center gap-1">
                    <span className="text-green-400 text-sm">🎯</span>
                    <span className="text-sm">Winning Pattern</span>
                  </h3>
                  <div className="w-full max-w-[260px] mx-auto relative p-1 bg-black/20 rounded-lg">
                    {/* B I N G O Headers */}
                    <div className="grid grid-cols-5 gap-0.5 mb-1 justify-items-center">
                      {["B", "I", "N", "G", "O"].map((letter, index) => (
                        <div
                          key={`header-${index}`}
                          className="w-10 h-8 flex items-center justify-center text-sm font-bold text-[#f0e14a] bg-[#2a3969] rounded border border-[#f0e14a] uppercase tracking-tight"
                        >
                          {letter}
                        </div>
                      ))}
                    </div>

                    {/* Winning Pattern Line Indicator - GREEN THEME (NO ANIMATION) */}
                    {bingoStatus?.patternInfo && (
                      <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow border border-green-400 flex items-center gap-1 whitespace-nowrap">
                          {(() => {
                            const rowNum = bingoStatus.patternInfo.rowIndex;
                            const colNum = bingoStatus.patternInfo.colIndex;

                            if (
                              rowNum !== null &&
                              !isNaN(rowNum) &&
                              rowNum >= 0 &&
                              rowNum <= 4
                            ) {
                              return (
                                <>
                                  <span className="text-[8px]">📏</span>
                                  Row {rowNum + 1}
                                </>
                              );
                            }

                            if (
                              colNum !== null &&
                              !isNaN(colNum) &&
                              colNum >= 0 &&
                              colNum <= 4
                            ) {
                              return (
                                <>
                                  <span className="text-[8px]">📐</span>
                                  Col {colNum + 1}
                                </>
                              );
                            }

                            return (
                              <>
                                <span className="text-[8px]">✨</span>
                                <span className="max-w-[80px] truncate">
                                  {bingoStatus.pattern
                                    ?.replace("_", " ")
                                    .toUpperCase() || "PATTERN"}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Bingo Card Grid - REMOVED ANIMATIONS */}
                    <div className="grid grid-cols-5 gap-0.5 pt-0.5 relative">
                      {(() => {
                        const cardData = bingoStatus.winnerCardNumbers || [];
                        const winningIndices = bingoStatus.winningIndices || [];
                        const winningNumbers = bingoStatus.winningNumbers || [];
                        const otherCalledNumbers =
                          bingoStatus.otherCalledNumbers || [];

                        const cardGrid =
                          Array.isArray(cardData) && Array.isArray(cardData[0])
                            ? cardData
                            : Array(5)
                                .fill()
                                .map(() => Array(5).fill("FREE"));

                        return cardGrid.map((row, rowIndex) =>
                          (row || Array(5).fill("FREE")).map(
                            (number, colIndex) => {
                              const cellIndex = rowIndex * 5 + colIndex;
                              const isFreeSpace = number === "FREE";
                              const isWinningCell =
                                winningIndices.includes(cellIndex);
                              const numberValue = Number(number);

                              // ✅ CRITICAL: Check if this specific number is a winning number vs other called number
                              const isWinningNumber =
                                winningNumbers.includes(numberValue);
                              const isOtherCalledNumber =
                                otherCalledNumbers.includes(numberValue);
                              const isCalled =
                                isFreeSpace ||
                                isWinningNumber ||
                                isOtherCalledNumber;

                              const displayNumber = isFreeSpace
                                ? "FREE"
                                : numberValue;

                              let cellStyle =
                                "w-10 h-10 flex items-center justify-center text-xs font-bold rounded border transition-all duration-300 shadow-sm relative overflow-hidden";
                              let textColor = "text-black";

                              if (isFreeSpace) {
                                // FREE space - Blue background
                                cellStyle +=
                                  " bg-blue-600 text-white border-blue-400";
                                textColor = "text-white";
                              } else if (isWinningCell && isWinningNumber) {
                                // 🟢 WINNING PATTERN NUMBER - GREEN background (NO ANIMATION)
                                cellStyle +=
                                  " bg-green-500 text-white border-green-600 shadow-green-500/50 relative";
                                textColor =
                                  "text-white font-bold drop-shadow-sm";
                              } else if (isOtherCalledNumber) {
                                // 🔵 OTHER CALLED NUMBER - BLUE background
                                cellStyle +=
                                  " bg-blue-500 text-white border-blue-300 shadow-blue-300/30";
                                textColor = "text-white font-medium";
                              } else if (isWinningCell && !isCalled) {
                                // 🟡 WINNING PATTERN but NOT CALLED - YELLOW background (NO ANIMATION)
                                cellStyle +=
                                  " bg-yellow-400 text-black border-yellow-600 shadow-yellow-300/30 relative";
                                textColor = "text-black font-semibold";
                              } else {
                                // ⚪ NOT CALLED, NOT WINNING PATTERN - White background
                                cellStyle +=
                                  " bg-white text-black border-gray-300 hover:bg-gray-50";
                                textColor = "text-black";
                              }

                              return (
                                <div
                                  key={`${rowIndex}-${colIndex}`}
                                  className={cellStyle}
                                >
                                  {/* REMOVED: All special effects for winning pattern cells */}
                                  {/* No ping, pulse, or star animations */}

                                  {/* Number marker for other called numbers */}
                                  {isOtherCalledNumber && (
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-400 rounded-full"></div>
                                  )}

                                  <span
                                    className={`relative z-10 text-center ${textColor}`}
                                  >
                                    {displayNumber}
                                  </span>
                                </div>
                              );
                            }
                          )
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Winning Numbers Summary — GREEN THEME (NO ANIMATION) */}
              {bingoStatus?.winningNumbers &&
                bingoStatus.winningNumbers.length > 0 && (
                  <div className="bg-green-900/30 border border-green-400 p-2 rounded-lg">
                    <h4 className="text-green-300 font-bold text-xs mb-1 flex items-center gap-1">
                      <span className="text-sm">🎯</span>
                      Winning Pattern Numbers (
                      {bingoStatus.winningNumbers.length})
                    </h4>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {bingoStatus.winningNumbers.slice(0, 10).map((n) => (
                        <div
                          key={n}
                          className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-600 flex items-center gap-0.5 shadow-md"
                        >
                          <span className="text-green-200 text-[8px]">⭐</span>
                          <span className="text-white">{n}</span>
                        </div>
                      ))}
                      {bingoStatus.winningNumbers.length > 10 && (
                        <span className="bg-green-600 text-green-900 px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-400">
                          +{bingoStatus.winningNumbers.length - 10}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* Compact Prize Display — Keep yellow for prize emphasis */}
              <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-400 p-2 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <div className="text-lg">💰</div>
                  <div className="text-center">
                    <p className="text-yellow-300 text-[10px] font-semibold uppercase tracking-wide">
                      PRIZE
                    </p>
                    <div className="text-lg font-bold text-yellow-400 bg-black/20 px-2 py-1 rounded border border-yellow-400">
                      {bingoStatus?.prize || "0.00"} BIRR
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Action Button */}
              <button
                className="bg-gradient-to-r from-[#e9744c] to-[#f0854c] text-white border px-6 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:from-[#f0854c] hover:to-[#e9744c] hover:shadow-lg w-full flex items-center justify-center gap-1 shadow-md"
                onClick={() => {
                  setIsWinnerModalOpen(false);
                  setBingoStatus(null);
                  setCallError(null);
                  console.log("[BingoWinnerModal] Closed winner modal");
                }}
              >
                <span>🎊</span>
                <span>Close</span>
              </button>
            </div>
          )}
        </div>
      )}
      {isNonWinnerModalOpen && nonWinnerCardData && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-4 rounded-xl z-50 text-center min-w-[320px] max-w-[380px] max-h-[90vh] overflow-y-auto shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <div className="space-y-3">
            <h2 className="text-[#f0e14a] mb-3 text-xl flex items-center justify-center gap-2">
              <span className="text-2xl">🃏</span>
              <span>Card Check</span>
            </h2>
            <p className="text-white text-base">
              Card{" "}
              <span className="text-[#f0e14a] font-bold">
                {nonWinnerCardData.cardId}
              </span>{" "}
              is not winner
            </p>

            {nonWinnerCardData.lateCall && nonWinnerCardData.wouldHaveWon && (
              <div className="bg-yellow-900/50 border border-yellow-400 p-3 rounded-lg">
                <h3 className="text-yellow-200 text-base font-semibold mb-2">
                  Late Call! ⏰
                </h3>
                <p className="text-yellow-100 text-sm mb-2">
                  {nonWinnerCardData.lateCallMessage ||
                    "You missed your chance!"}
                </p>
                <div className="text-xs text-yellow-200 space-y-1">
                  <p>
                    <strong>Pattern:</strong>{" "}
                    {nonWinnerCardData.wouldHaveWon.pattern?.replace(
                      "_",
                      " "
                    ) || "unknown"}
                  </p>
                  <p>
                    <strong>On call:</strong> #
                    {nonWinnerCardData.wouldHaveWon.callIndex}
                  </p>
                  <p>
                    <strong>Missing number:</strong>{" "}
                    {nonWinnerCardData.wouldHaveWon.completingNumber}
                  </p>
                </div>
              </div>
            )}

            {/* Card Display - Retained with markings */}
            <div className="mt-3">
              <h3 className="text-white text-base font-semibold mb-2 flex items-center justify-center gap-1">
                <span className="text-green-400 text-sm">🎯</span>
                <span className="text-sm">Card Details</span>
              </h3>
              <div className="w-full max-w-[260px] mx-auto relative p-1 bg-black/20 rounded-lg">
                {/* B I N G O Headers */}
                <div className="grid grid-cols-5 gap-0.5 mb-1 justify-items-center">
                  {["B", "I", "N", "G", "O"].map((letter, index) => (
                    <div
                      key={`header-${index}`}
                      className="w-10 h-8 flex items-center justify-center text-sm font-bold text-[#f0e14a] bg-[#2a3969] rounded border border-[#f0e14a] uppercase tracking-tight"
                    >
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Pattern Indicator */}
                {nonWinnerCardData.patternInfo && (
                  <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow border border-green-400 flex items-center gap-1 whitespace-nowrap">
                      {(() => {
                        const rowNum = nonWinnerCardData.patternInfo.rowIndex;
                        const colNum = nonWinnerCardData.patternInfo.colIndex;

                        if (
                          rowNum !== null &&
                          !isNaN(rowNum) &&
                          rowNum >= 0 &&
                          rowNum <= 4
                        ) {
                          return <>📏 Row {rowNum + 1}</>;
                        }
                        if (
                          colNum !== null &&
                          !isNaN(colNum) &&
                          colNum >= 0 &&
                          colNum <= 4
                        ) {
                          return <>📐 Col {colNum + 1}</>;
                        }
                        return (
                          <>
                            <span className="text-[8px]">✨</span>
                            <span className="max-w-[80px] truncate">
                              {nonWinnerCardData.pattern
                                ?.replace("_", " ")
                                .toUpperCase() || "PATTERN"}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Bingo Card Grid - Green for pattern called, yellow for other called */}
                <div className="grid grid-cols-5 gap-0.5 pt-0.5 relative">
                  {(() => {
                    const cardData = nonWinnerCardData.cardNumbers || [];
                    const patternIndices =
                      nonWinnerCardData.patternInfo?.selectedIndices || [];
                    const calledInPattern =
                      nonWinnerCardData.calledNumbersInPattern || [];
                    const otherCalled =
                      nonWinnerCardData.otherCalledNumbers || [];
                    const allCalled = [...calledInPattern, ...otherCalled].map(
                      Number
                    );

                    const cardGrid =
                      Array.isArray(cardData) && Array.isArray(cardData[0])
                        ? cardData
                        : Array(5)
                            .fill()
                            .map(() => Array(5).fill("FREE"));

                    return cardGrid.map((row, rowIndex) =>
                      (row || Array(5).fill("FREE")).map((number, colIndex) => {
                        const cellIndex = rowIndex * 5 + colIndex;
                        const isFree = number === "FREE";
                        const isPatternCell =
                          patternIndices.includes(cellIndex);
                        const num = Number(number);
                        const isCalledInPattern = calledInPattern.includes(num);
                        const isOtherCalled =
                          otherCalled.includes(num) && !isCalledInPattern;
                        const displayNum = isFree ? "FREE" : num;

                        let cellStyle =
                          "w-10 h-10 flex items-center justify-center text-xs font-bold rounded border transition-all duration-300 shadow-sm relative overflow-hidden";

                        if (isFree) {
                          cellStyle +=
                            " bg-blue-600 text-white border-blue-400";
                        } else if (isCalledInPattern) {
                          cellStyle +=
                            " bg-green-600 text-white border-green-400 shadow-green-400/30 scale-[1.02]";
                        } else if (isOtherCalled) {
                          cellStyle +=
                            " bg-yellow-600 text-white border-yellow-400 shadow-yellow-400/30";
                        } else {
                          cellStyle += " bg-white text-black border-gray-300";
                        }

                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={cellStyle}
                          >
                            {isCalledInPattern && (
                              <>
                                <div className="absolute inset-0 rounded opacity-20 bg-green-400 animate-pulse"></div>
                                <div className="absolute -top-[2px] -right-[2px] w-2 h-2 bg-yellow-400 rounded-full text-[6px] flex items-center justify-center font-bold text-black">
                                  *
                                </div>
                              </>
                            )}
                            <span className="relative z-10 text-center">
                              {displayNum}
                            </span>
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
            </div>

            <button
              className="bg-gradient-to-r from-[#e9744c] to-[#f0854c] text-white border px-6 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:from-[#f0854c] hover:to-[#e9744c] hover:shadow-lg w-full flex items-center justify-center gap-1 shadow-md"
              onClick={() => {
                setIsNonWinnerModalOpen(false);
                setNonWinnerCardData(null);
              }}
            >
              <span>✅</span>
              <span>Close</span>
            </button>
          </div>
        </div>
      )}
      {/* Jackpot Winner Modal */}
      {isJackpotWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] z-60">
          <canvas
            ref={jackpotCanvasRef}
            className="absolute inset-0 w-full h-full"
          ></canvas>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-8 border-[#f0e14a] p-8 rounded-2xl text-center min-w-[400px] shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-65">
            <h2 className="text-[#f0e14a] mb-4 text-5xl font-extrabold uppercase tracking-wider bg-[#1a2a6c] py-3 px-6 rounded-lg shadow-inner">
              JACKPOT EXPLODED!
            </h2>
            <p className="mb-4 text-2xl text-white font-semibold">
              {jackpotWinner.message}
            </p>
            <p className="mb-4 text-2xl text-white font-bold">
              Congratulations, {jackpotWinner.userId}!
            </p>
            <div className="w-[300px] h-[150px] mx-auto mb-6 flex items-center justify-center relative">
              <div className="text-[#f0e14a] text-4xl font-extrabold bg-black/70 px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(240,225,74,0.8)]">
                {jackpotWinner.prize.toFixed(2)} BIRR
              </div>
            </div>
            <button
              className="bg-[#e9744c] text-white border-none px-6 py-3 font-bold rounded-lg cursor-pointer text-base transition-all duration-300 hover:bg-[#f0854c] hover:scale-105 shadow-[0_0_15px_rgba(233,116,76,0.5)]"
              onClick={() => setIsJackpotWinnerModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Game Finished Modal */}
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
              className="bg-[#e9744c] text-white border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:bg-[#f0854c]"
              onClick={handleStartNextGame}
              disabled={isLoading}
            >
              {isLoading ? "Starting..." : "Start Next Game"}
            </button>
          </div>
        </div>
      )}
      {/* Error Modal */}
      {isErrorModalOpen && callError && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-950 border-4 border-orange-500 p-5 rounded-xl z-50 text-center min-w-[300px] shadow-2xl">
          <h2 className="text-orange-500 mb-4 text-2xl">Error</h2>
          <p className="mb-4 text-lg text-white">{callError}</p>
          <button
            className="bg-orange-400 text-black px-4 py-2 font-bold rounded text-sm hover:bg-orange-300 transition-colors duration-300"
            onClick={() => {
              setIsErrorModalOpen(false);
              setCallError(null);
              if (
                callError.includes("Invalid game ID") ||
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
      {/* Settings Sidebar */}
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
      {/* Hidden Canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      {/* CSS for Fallback Animation */}
      <style jsx>{`
        @keyframes explode1 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(120px, -120px);
            opacity: 0;
          }
        }
        @keyframes explode2 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-100px, -140px);
            opacity: 0;
          }
        }
        @keyframes explode3 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(140px, -100px);
            opacity: 0;
          }
        }
        @keyframes explode4 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-120px, 120px);
            opacity: 0;
          }
        }
        @keyframes explode5 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(100px, 140px);
            opacity: 0;
          }
        }
        .animate-fireworks {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .animate-explode1,
        .animate-explode2,
        .animate-explode3,
        .animate-explode4,
        .animate-explode5 {
          animation-duration: 2s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
        }
        .animate-explode1 {
          animation-name: explode1;
        }
        .animate-explode2 {
          animation-name: explode2;
          animation-delay: 0.4s;
        }
        .animate-explode3 {
          animation-name: explode3;
          animation-delay: 0.8s;
        }
        .animate-explode4 {
          animation-name: explode4;
          animation-delay: 1.2s;
        }
        .animate-explode5 {
          animation-name: explode5;
          animation-delay: 1.6s;
        }
      `}</style>
    </div>
  );
};

export default BingoGame;
