import API from "./axios";

const gameService = {
  createGame: async (data) => {
    try {
      const response = await API.post("/games", data);
      console.log("gameService.createGame response:", response);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.createGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getGame: async (id) => {
    try {
      const response = await API.get(`/games/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAllGames: async () => {
    try {
      const response = await API.get("/games");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getAllGames error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getNextPendingGame: async () => {
    try {
      const response = await API.get("/games/next-pending");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getNextPendingGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAllCards: async () => {
    try {
      const response = await API.get("/games/cards");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getAllCards error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  callNumber: async (gameId, number) => {
    try {
      const response = await API.post(`/games/${gameId}/call-number`, {
        number,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.callNumber error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  checkBingo: async (gameId, cardId) => {
    try {
      const response = await API.post(`/games/${gameId}/check-bingo`, {
        cardId,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.checkBingo error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  selectWinner: async (gameId, data) => {
    try {
      const response = await API.post(`/games/${gameId}/select-winner`, data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.selectWinner error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  finishGame: async (gameId, moderatorCardId = null) => {
    try {
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
        error.response?.data || error.message
      );
      throw error;
    }
  },

  startGame: async (gameId) => {
    try {
      const response = await API.post(`/games/${gameId}/start`);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.startGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updateGame: async (gameId, data) => {
    try {
      const response = await API.patch(`/games/${gameId}`, data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.updateGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getJackpot: async () => {
    try {
      const response = await API.get("/games/jackpot");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.getJackpot error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  resetGameCounter: async () => {
    try {
      const response = await API.post("/games/reset-game-counter");
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.resetGameCounter error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  createSequentialGames: async (data) => {
    try {
      const response = await API.post("/games/sequential", data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.createSequentialGames error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  configureFutureWinners: async (winners) => {
    try {
      const response = await API.post("/games/configure-future-winners", {
        winners,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.configureFutureWinners error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  configureNextGameNumber: async (startNumber) => {
    try {
      const response = await API.post("/games/configure-next", { startNumber });
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.configureNextGameNumber error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  createFutureGames: async (data) => {
    try {
      const response = await API.post("/games/future", data);
      return response.data.data;
    } catch (error) {
      console.error(
        "gameService.createFutureGames error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};

export default gameService;
