import API from "./axios";

const gameService = {
  createGame: async (data) => {
    try {
      console.log(
        "gameService.createGame - Sending data:",
        JSON.stringify(data, null, 2)
      );
      const response = await API.post("/games", data);
      console.log("gameService.createGame response:", response.data);
      return response.data.game;
    } catch (error) {
      console.error(
        "gameService.createGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getGame: async (id) => {
    try {
      if (!id) throw new Error("Game ID is required");
      console.log("gameService.getGame - Fetching game ID:", id);
      const response = await API.get(`/games/${id}`);
      console.log("gameService.getGame response:", response.data);
      if (!response.data.game) {
        throw new Error("No game data returned");
      }
      return response.data.game;
    } catch (error) {
      console.error(
        "gameService.getGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getAllGames: async () => {
    try {
      console.log("gameService.getAllGames - Fetching all games");
      const response = await API.get("/games");
      return response.data.games;
    } catch (error) {
      console.error(
        "gameService.getAllGames error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getNextPendingGame: async () => {
    try {
      console.log(
        "gameService.getNextPendingGame - Fetching next pending game"
      );
      const response = await API.get("/games/next-pending");
      return response.data.game;
    } catch (error) {
      console.error(
        "gameService.getNextPendingGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getAllCards: async () => {
    try {
      console.log("gameService.getAllCards - Fetching all cards");
      const response = await API.get("/games/cards");
      console.log("gameService.getAllCards response:", response.data.data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getAllCards error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  callNumber: async (gameId, number) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      if (!number || number < 1 || number > 75)
        throw new Error("Invalid number");
      console.log(
        `gameService.callNumber - Calling number ${number} for game ${gameId}`
      );
      const response = await API.post(`/games/${gameId}/call-number`, {
        number,
      });
      console.log("gameService.callNumber response:", response.data);

      // The backend returns: { message, game, calledNumber, callType }
      // Return the full response data so the component can access all fields
      return response.data;
    } catch (error) {
      console.error(
        "gameService.callNumber error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  checkBingo: async (gameId, cardId) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      if (!cardId || isNaN(cardId))
        throw new Error("Valid card ID is required");
      console.log(
        `gameService.checkBingo - Checking card ${cardId} for game ${gameId}`
      );
      const response = await API.post(`/games/${gameId}/check-bingo`, {
        cardId: Number(cardId),
      });
      console.log("gameService.checkBingo response:", response.data.data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.checkBingo FULL ERROR:",
        JSON.stringify(
          {
            message: error.message,
            response: error.response
              ? {
                  status: error.response.status,
                  data: error.response.data,
                  headers: error.response.headers,
                }
              : null,
            request: error.request ? "Exists" : null,
            config: error.config
              ? {
                  url: error.config.url,
                  method: error.config.method,
                }
              : null,
          },
          null,
          2
        )
      );
      throw error;
    }
  },

  selectWinner: async (gameId, data) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      console.log(
        `gameService.selectWinner - Selecting winner for game ${gameId}`
      );
      const response = await API.post(`/games/${gameId}/select-winner`, data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.selectWinner error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  selectJackpotWinner: async (gameId) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      console.log(
        `gameService.selectJackpotWinner - Selecting jackpot winner for game ${gameId}`
      );
      const response = await API.post(`/games/${gameId}/select-jackpot-winner`);
      console.log("gameService.selectJackpotWinner response:", response);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.selectJackpotWinner error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  finishGame: async (gameId, moderatorCardId = null) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      console.log(
        `gameService.finishGame - Finishing game ${gameId}, moderatorCardId: ${moderatorCardId}`
      );
      const response = await API.post(`/games/${gameId}/finish`, {
        moderatorCardId,
      });
      console.log(
        "gameService.finishGame full response:",
        JSON.stringify(response, null, 2)
      );
      console.log(
        "gameService.finishGame response.data.data:",
        response.data.data
      );
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.finishGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  startGame: async (gameId) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      if (typeof gameId !== "string" || !/^[0-9a-fA-F]{24}$/.test(gameId)) {
        throw new Error("Invalid game ID format");
      }
      console.log("gameService.startGame - Starting game with ID:", gameId);
      const response = await API.post(`/games/${gameId}/start`);
      console.log("gameService.startGame response:", response.data);
      // Adjusted to return response.data directly, as per backend response structure
      // (e.g., { message: "Game X started successfully", status: "active" } or full game object)
      return response.data;
    } catch (error) {
      console.error(
        "gameService.startGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  updateGame: async (gameId, data) => {
    try {
      if (!gameId) throw new Error("Game ID is required");
      console.log(
        `gameService.updateGame - Updating game ${gameId} with data:`,
        JSON.stringify(data, null, 2)
      );
      const response = await API.patch(`/games/${gameId}`, data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.updateGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getJackpot: async (cashierId) => {
    try {
      if (!cashierId) throw new Error("Cashier ID is required");
      console.log(
        "gameService.getJackpot - Fetching jackpot for cashierId:",
        cashierId
      );
      const response = await API.get(`/games/jackpot?cashierId=${cashierId}`);
      console.log(
        "gameService.getJackpot response:",
        JSON.stringify(response.data, null, 2)
      );
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getJackpot error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  resetGameCounter: async () => {
    try {
      console.log("gameService.resetGameCounter - Resetting counter");
      const response = await API.post("/games/reset-game-counter");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.resetGameCounter error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  createSequentialGames: async (data) => {
    try {
      console.log(
        "gameService.createSequentialGames - Creating sequential games:",
        JSON.stringify(data, null, 2)
      );
      const response = await API.post("/games/sequential", data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.createSequentialGames error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  configureFutureWinners: async (winners) => {
    try {
      console.log(
        "gameService.configureFutureWinners - Configuring winners:",
        JSON.stringify({ winners }, null, 2)
      );
      const response = await API.post("/games/configure-future-winners", {
        winners,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.configureFutureWinners error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  configureNextGameNumber: async (startNumber) => {
    try {
      console.log(
        "gameService.configureNextGameNumber - Configuring next number:",
        startNumber
      );
      const response = await API.post("/games/configure-next", { startNumber });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.configureNextGameNumber error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  createFutureGames: async (data) => {
    try {
      console.log(
        "gameService.createFutureGames - Creating future games:",
        JSON.stringify(data, null, 2)
      );
      const response = await API.post("/games/future", data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.createFutureGames error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getCashierReport: async (cashierId) => {
    try {
      if (!cashierId) throw new Error("Cashier ID is required");
      console.log(
        "gameService.getCashierReport - Fetching cashier report for cashierId:",
        cashierId
      );
      const response = await API.get(`/games/report?cashierId=${cashierId}`);
      console.log("gameService.getCashierReport response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "gameService.getCashierReport error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },
};

export default gameService;
