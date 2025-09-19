import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LanguageContext } from "../../context/LanguageProvider";
import { useBingoGame } from "../../hooks/useBingoGame";
import gameService from "../../services/game";
import moderatorService from "../../services/moderator";
import SoundService from "../../services/sound";
import io from "socket.io-client";

const BingoGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, translations } = useContext(LanguageContext);
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
  const [speed, setSpeed] = useState(
    parseInt(localStorage.getItem("callSpeed")) || 8
  );
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
  const [winningPattern, setWinningPattern] = useState("all");
  const [winningCards, setWinningCards] = useState([]);
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
  const [jackpotWinner, setJackpotWinner] = useState({
    userId: "",
    prize: 0,
    drawDate: "",
    message: "",
  });

  // Refs
  const canvasRef = useRef(null);
  const jackpotCanvasRef = useRef(null);
  const autoIntervalRef = useRef(null);
  const containerRef = useRef(null);
  const jackpotRef = useRef(null);
  const socketRef = useRef(null);
  const p5InstanceRef = useRef(null);

  // Initialize Socket.IO client
  useEffect(() => {
    socketRef.current = io("http://localhost:5000", {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    if (gameData?.cashierId) {
      socketRef.current.emit("joinCashierRoom", gameData.cashierId);
      console.log(`Joined cashier room: ${gameData.cashierId}`);
    }

    socketRef.current.on("jackpotAwarded", (data) => {
      console.log("Jackpot awarded event received:", data);
      setJackpotWinner({
        userId: data.userId || "--",
        prize: data.prize || 0,
        drawDate: new Date(data.drawDate).toLocaleDateString(),
        message: data.message || "Jackpot awarded!",
      });
      setIsJackpotWinnerModalOpen(true);
      setIsJackpotActive(false);
      setJackpotCandidates([]);
      setJackpotAmount(0);
      SoundService.playSound("jackpot_congrats");
      setTimeout(() => setIsJackpotWinnerModalOpen(false), 10000);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [gameData?.cashierId]);

  // Initialize p5.js for jackpot animation
  useEffect(() => {
    if (isJackpotWinnerModalOpen && jackpotCanvasRef.current && window.p5) {
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
          if (p.frameCount % 3 === 0 && particles.length < 150) {
            particles.push(new Particle());
          }
          fireballs = fireballs.filter((fireball) => !fireball.isFinished());
          fireballs.forEach((fireball) => {
            fireball.update();
            fireball.display();
          });
          if (p.frameCount % 10 === 0 && fireballs.length < 25) {
            fireballs.push(new Fireball());
          }
          confetti = confetti.filter((confetti) => !confetti.isFinished());
          confetti.forEach((confetti) => {
            confetti.update();
            confetti.display();
          });
          if (p.frameCount % 5 === 0 && confetti.length < 100) {
            confetti.push(new Confetti());
          }
          sparkles = sparkles.filter((sparkle) => !sparkle.isFinished());
          sparkles.forEach((sparkle) => {
            sparkle.update();
            sparkle.display();
          });
          if (p.frameCount % 8 === 0 && sparkles.length < 50) {
            sparkles.push(new Sparkle());
          }
        };
      };

      try {
        p5InstanceRef.current = new window.p5(sketch, jackpotCanvasRef.current);
        console.log("p5.js instance created successfully");
      } catch (error) {
        console.error("Failed to initialize p5.js:", error);
        setCallError("Failed to load jackpot animation");
        setIsErrorModalOpen(true);
      }
    }

    return () => {
      if (p5InstanceRef.current) {
        console.log("Removing p5.js instance");
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [isJackpotWinnerModalOpen]);

  // Existing useEffect hooks
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
      setWinningPattern(game.pattern?.replace("_", " ") || "all");
      setCalledNumbers(game.calledNumbers || []);
      setIsGameOver(game.status === "completed");
    }
  }, [game]);

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
      !isCallingNumber
    ) {
      autoIntervalRef.current = setInterval(() => {
        handleCallNumber();
      }, speed * 1000);
    }

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [isAutoCall, speed, isGameOver, isPlaying, isCallingNumber, gameData]);

  useEffect(() => {
    localStorage.setItem("callSpeed", speed);
  }, [speed]);

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
        setJackpotAmount(0);
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

  const getWinningPatternPositions = (pattern) => {
    const positions = [];
    switch (pattern) {
      case "four_corners_center":
        positions.push([0, 0], [0, 4], [4, 0], [4, 4], [2, 2]);
        break;
      case "cross":
        positions.push(
          [0, 2],
          [1, 2],
          [2, 0],
          [2, 1],
          [2, 2],
          [2, 3],
          [2, 4],
          [3, 2],
          [4, 2]
        );
        break;
      case "main_diagonal":
        positions.push([0, 0], [1, 1], [2, 2], [3, 3], [4, 4]);
        break;
      case "other_diagonal":
        positions.push([0, 4], [1, 3], [2, 2], [3, 1], [4, 0]);
        break;
      case "horizontal_line":
        for (let row = 0; row < 5; row++) {
          positions.push([row, 0], [row, 1], [row, 2], [row, 3], [row, 4]);
        }
        break;
      case "vertical_line":
        for (let col = 0; col < 5; col++) {
          positions.push([0, col], [1, col], [2, col], [3, col], [4, col]);
        }
        break;
      case "all":
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            positions.push([row, col]);
          }
        }
        break;
      default:
        break;
    }
    return positions;
  };

  const renderWinningCard = (card) => {
    const grid = [];
    const letters = ["B", "I", "N", "G", "O"];
    const winningPositions = getWinningPatternPositions(
      gameData?.forcedPattern || gameData?.pattern || "all"
    );
    for (let row = 0; row < 5; row++) {
      const rowCells = [];
      for (let col = 0; col < 5; col++) {
        const number = card.numbers[letters[col]][row];
        const isMarked = card.markedPositions[letters[col]][row];
        const isWinningPosition = winningPositions.some(
          ([winRow, winCol]) => winRow === row && winCol === col
        );
        rowCells.push(
          <div
            key={`${row}-${col}`}
            className={`w-12 h-12 flex justify-center items-center text-lg font-bold border border-gray-600 dark:border-gray-400 ${
              number === "FREE"
                ? "bg-blue-600 text-white"
                : isMarked && isWinningPosition
                ? "bg-yellow-300 text-black animate-pulse"
                : isMarked
                ? "bg-blue-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {number}
          </div>
        );
      }
      grid.push(
        <div key={`row-${row}`} className="flex gap-1">
          {rowCells}
        </div>
      );
    }
    return (
      <div className="grid gap-1">
        <div className="flex gap-1">
          {letters.map((letter) => (
            <div
              key={letter}
              className="w-12 h-12 flex justify-center items-center text-lg font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-600 dark:border-gray-400"
            >
              {letter}
            </div>
          ))}
        </div>
        {grid}
      </div>
    );
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
              gameData.forcedPattern || gameData.pattern
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

      console.log(`Calling number ${numberToCall} for game ${gameData._id}`);
      const response = await callNumber(gameData._id, { number: numberToCall });
      const calledNumber = response.calledNumber || numberToCall;

      setCalledNumbers((prev) => {
        if (!prev.includes(calledNumber)) {
          return [...prev, calledNumber];
        }
        return prev;
      });

      setLastCalledNumbers((prev) => {
        const newList = [calledNumber, ...prev.slice(0, 4)];
        return [...new Set(newList)].slice(0, 5);
      });
      setCurrentNumber(calledNumber);
      setGameData(response.game);

      setBingoCards((prevCards) =>
        prevCards.map((card) => {
          const newCard = { ...card };
          const flatNumbers = card.numbers.B.concat(
            card.numbers.I,
            card.numbers.N,
            card.numbers.G,
            card.numbers.O
          );
          const grid = [];
          for (let row = 0; row < 5; row++) {
            grid[row] = [];
            for (let col = 0; col < 5; col++) {
              const index = row * 5 + col;
              grid[row][col] = flatNumbers[index];
            }
          }
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
              if (grid[row][col] === calledNumber) {
                const letters = ["B", "I", "N", "G", "O"];
                const letter = letters[col];
                newCard.markedPositions[letter][row] = true;
              }
            }
          }
          return newCard;
        })
      );

      SoundService.playSound(`number_${calledNumber}`);
      if (manualNum) setManualNumber("");
    } catch (error) {
      console.error("Error calling number:", error);
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
      setCallError("Invalid game ID");
      setIsErrorModalOpen(true);
      return;
    }
    if (!cardId) {
      setCallError("No card selected");
      setIsErrorModalOpen(true);
      return;
    }
    const numericCardId = parseInt(cardId, 10);
    if (isNaN(numericCardId) || numericCardId < 1) {
      setCallError("Invalid card ID");
      setIsErrorModalOpen(true);
      return;
    }
    const isValidCardInGame = gameData.selectedCards?.some(
      (card) => card.id === numericCardId
    );
    if (!isValidCardInGame) {
      setCallError(`Card ${numericCardId} is not playing in this game`);
      setIsErrorModalOpen(true);
      SoundService.playSound("you_didnt_win");
      return;
    }
    if (isGameOver || gameData.status === "completed") {
      if (
        (gameData.winner?.cardId && gameData.winner.cardId === numericCardId) ||
        (gameData.moderatorWinnerCardId &&
          gameData.moderatorWinnerCardId === numericCardId)
      ) {
        setIsWinnerModalOpen(true);
        setWinningCards([numericCardId]);
        SoundService.playSound("winner");
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
        setJackpotAmount(response.game.winner?.prize || 0);
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
      let userFriendlyMessage =
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred";
      if (
        userFriendlyMessage.includes("The provided card is not in the game") ||
        userFriendlyMessage.includes("Card not found in game")
      ) {
        userFriendlyMessage = `Card ${cardId} not found in game #${
          gameData?.gameNumber || "unknown"
        }`;
      }
      setCallError(userFriendlyMessage);
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

  const getNumbersForPattern = (cardNumbers, pattern) => {
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));
    }
    const numbers = [];
    if (pattern === "four_corners_center") {
      numbers.push(grid[0][0], grid[0][4], grid[4][0], grid[4][4], grid[2][2]);
    } else if (pattern === "cross") {
      numbers.push(
        grid[0][2],
        grid[1][2],
        grid[2][0],
        grid[2][1],
        grid[2][2],
        grid[2][3],
        grid[2][4],
        grid[3][2],
        grid[4][2]
      );
    } else if (pattern === "main_diagonal") {
      numbers.push(grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]);
    } else if (pattern === "other_diagonal") {
      numbers.push(grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]);
    } else if (pattern === "horizontal_line") {
      for (let i = 0; i < 5; i++) {
        numbers.push(...grid[i].filter((n) => n !== "FREE"));
      }
    } else if (pattern === "vertical_line") {
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          if (grid[row][col] !== "FREE") numbers.push(grid[row][col]);
        }
      }
    } else if (pattern === "all") {
      numbers.push(...cardNumbers.filter((n) => n !== "FREE"));
    }
    return numbers.map((n) => (n === "FREE" ? n : Number(n)));
  };

  const toggleLanguage = () => {
    // Assuming a toggleLanguage function is defined in LanguageContext
    // This is a placeholder; replace with actual implementation
    console.log("Toggling language");
  };

  // UI Generation
  const generateBoard = () => {
    const letters = [
      { letter: "B", color: "bg-red-600" },
      { letter: "I", color: "bg-yellow-300" },
      { letter: "N", color: "bg-green-500" },
      { letter: "G", color: "bg-blue-600" },
      { letter: "O", color: "bg-purple-600" },
    ];
    const board = [];
    for (let i = 1; i <= 75; i++) {
      const isCalled = calledNumbers.includes(i);
      const letterIndex = Math.floor((i - 1) / 15);
      const letter = letters[letterIndex].letter;
      const color = letters[letterIndex].color;
      board.push(
        <div
          key={i}
          className={`w-12 h-12 flex justify-center items-center text-lg font-bold border border-gray-600 dark:border-gray-400 ${
            isCalled
              ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
              : color + " text-white"
          } ${currentNumber === i ? "animate-pulse" : ""}`}
        >
          {letter}-{i}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-15 gap-1 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        {board}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4"
    >
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="mx-auto mb-4 w-8 h-8 border-2 border-gray-600 dark:border-gray-400 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-gray-800 dark:text-gray-200">Loading game...</p>
          </div>
        </div>
      )}
      {isErrorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
              Error
            </h3>
            <p className="text-gray-800 dark:text-gray-200 mt-2">{callError}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsErrorModalOpen(false)}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isWinnerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
              {translations[language].bingoWinner}
            </h3>
            <p className="text-gray-800 dark:text-gray-200 mt-2">
              {translations[language].congratulations} Card #{winningCards[0]}{" "}
              has won Game #{gameData?.gameNumber} with{" "}
              {(gameData?.forcedPattern || gameData?.pattern || "all").replace(
                "_",
                " "
              )}{" "}
              pattern!
            </p>
            <p className="text-gray-800 dark:text-gray-200 mt-2">
              Prize: {gameData?.prizePool?.toFixed(2) || 0} BIRR
            </p>
            <div className="mt-4">
              <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                Winning Card
              </h4>
              {bingoCards
                .filter((card) => winningCards.includes(card.cardId))
                .map((card) => (
                  <div key={card.cardId} className="mt-2">
                    <p className="text-gray-800 dark:text-gray-200">
                      Card #{card.cardNumber}
                    </p>
                    {renderWinningCard(card)}
                  </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setIsWinnerModalOpen(false)}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Close
              </button>
              {user?.role === "moderator" && (
                <button
                  onClick={handleStartNextGame}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Start Next Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {isJackpotWinnerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full relative overflow-hidden">
            <div ref={jackpotCanvasRef} className="absolute inset-0 z-0"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {translations[language].jackpotWinner}
              </h3>
              <p className="text-gray-800 dark:text-gray-200 mt-2">
                {translations[language].congratulations} {jackpotWinner.userId}{" "}
                has won the jackpot of {jackpotWinner.prize} BIRR on{" "}
                {jackpotWinner.drawDate}!
              </p>
              <p className="text-gray-800 dark:text-gray-200 mt-2">
                {jackpotWinner.message}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setIsJackpotWinnerModalOpen(false)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isGameFinishedModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {translations[language].gameFinished}
            </h3>
            <p className="text-gray-800 dark:text-gray-200 mt-2">
              Game #{gameData?.gameNumber} has ended.
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setIsGameFinishedModalOpen(false)}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Close
              </button>
              {user?.role === "moderator" && (
                <button
                  onClick={handleStartNextGame}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Start Next Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Bingo Game #{gameData?.gameNumber || "Loading..."}
          </h1>
          <div className="flex space-x-2">
            <button
              onClick={toggleLanguage}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded"
            >
              {language === "en" ? "Switch to Amharic" : "Switch to English"}
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded"
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded"
            >
              {isSettingsOpen ? "Close Settings" : "Settings"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                {translations[language].gameBoard}
              </h2>
              {generateBoard()}
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                {translations[language].lastCalledNumbers}
              </h2>
              <div className="flex space-x-2">
                {lastCalledNumbers.map((num, index) => (
                  <div
                    key={index}
                    className="w-12 h-12 flex justify-center items-center text-lg font-bold bg-blue-600 text-white rounded"
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Game Info
              </h2>
              <p className="text-gray-800 dark:text-gray-200">
                Pattern:{" "}
                {(
                  gameData?.forcedPattern ||
                  gameData?.pattern ||
                  "all"
                ).replace("_", " ")}
              </p>
              <p className="text-gray-800 dark:text-gray-200">
                Prize Pool: {gameData?.prizePool?.toFixed(2) || 0} BIRR
              </p>
              <p className="text-gray-800 dark:text-gray-200">
                Status: {gameData?.status || "Loading..."}
              </p>
            </div>
          </div>
          <div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                {translations[language].gameControls}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {translations[language].callNumber}
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value)}
                      className="w-20 p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      placeholder="1-75"
                      min="1"
                      max="75"
                      disabled={isGameOver || isCallingNumber || !isPlaying}
                    />
                    <button
                      onClick={handleManualCall}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                      disabled={isGameOver || isCallingNumber || !isPlaying}
                    >
                      {translations[language].call}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {translations[language].checkCard}
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value)}
                      className="w-20 p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      placeholder="Card ID"
                      min="1"
                      disabled={isGameOver || isCallingNumber}
                    />
                    <button
                      onClick={() => handleCheckCard(cardId)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                      disabled={isGameOver || isCallingNumber}
                    >
                      {translations[language].check}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {translations[language].callSpeed}
                  </label>
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    disabled={isGameOver || isCallingNumber}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                      <option key={s} value={s}>
                        {s} seconds
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handlePlayPause}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    disabled={isGameOver}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => setIsAutoCall(!isAutoCall)}
                    className={`px-4 py-2 rounded text-white ${
                      isAutoCall
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    } disabled:opacity-50`}
                    disabled={isGameOver || !isPlaying}
                  >
                    {isAutoCall ? "Stop Auto Call" : "Auto Call"}
                  </button>
                  <button
                    onClick={handleFinish}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                    disabled={isGameOver}
                  >
                    Finish Game
                  </button>
                </div>
              </div>
            </div>
            {user?.role === "moderator" && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  Moderator Controls
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Jackpot Amount
                    </label>
                    <div
                      className={`text-2xl font-bold ${
                        jackpotGrow
                          ? "animate-pulse text-yellow-600"
                          : "text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {jackpotAmount.toFixed(2)} BIRR
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleToggleJackpot}
                      className={`w-full px-4 py-2 rounded text-white ${
                        isJackpotActive
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {isJackpotActive ? "Disable Jackpot" : "Enable Jackpot"}
                    </button>
                  </div>
                  <div>
                    <button
                      onClick={handleExplodeJackpot}
                      className="w-full bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                      disabled={!isJackpotActive || !jackpotCandidates.length}
                    >
                      Explode Jackpot
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Add Jackpot Candidate
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newCandidate.identifier}
                        onChange={(e) =>
                          setNewCandidate({
                            ...newCandidate,
                            identifier: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="ID, Phone, or Name"
                      />
                      <select
                        value={newCandidate.identifierType}
                        onChange={(e) =>
                          setNewCandidate({
                            ...newCandidate,
                            identifierType: e.target.value,
                          })
                        }
                        className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="id">ID</option>
                        <option value="phone">Phone</option>
                        <option value="name">Name</option>
                      </select>
                    </div>
                    <select
                      value={newCandidate.days}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          days: Number(e.target.value),
                        })
                      }
                      className="w-full mt-2 p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="7">7 Days</option>
                      <option value="14">14 Days</option>
                    </select>
                    <button
                      onClick={handleAddJackpotCandidate}
                      className="w-full mt-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                      Add Candidate
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      Jackpot Candidates
                    </h3>
                    <ul className="mt-2 max-h-40 overflow-y-auto">
                      {jackpotCandidates.map((candidate, index) => (
                        <li
                          key={index}
                          className="text-gray-800 dark:text-gray-200"
                        >
                          {candidate.identifier} ({candidate.identifierType},{" "}
                          {candidate.days} days)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {isSettingsOpen && (
          <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Call Speed (seconds)
                </label>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s}>
                      {s} seconds
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BingoGame;
