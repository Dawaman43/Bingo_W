import API from "./axios";

const gameService = {
  createGame: async (data) => {
    try {
      const response = await API.post("/games", data);
      console.log("gameService.createGame response:", response);
      return response; // Already fixed to return full response
    } catch (error) {
      console.error("gameService.createGame error:", error);
      throw error;
    }
  },

  getGame: async (id) => {
    const response = await API.get(`/games/${id}`);
    return response.data.data;
  },

  getAllGames: async () => {
    const response = await API.get("/games");
    return response.data.data;
  },

  getAllCards: async () => {
    const response = await API.get("/games/cards");
    return response.data.data;
  },

  callNumber: async (gameId, number) => {
    const response = await API.post(`/games/${gameId}/call-number`, { number });
    return response.data.data;
  },

  checkBingo: async (gameId, cardId) => {
    const response = await API.post(`/games/${gameId}/check-bingo`, { cardId });
    return response.data.data;
  },

  selectWinner: async (gameId, data) => {
    const response = await API.post(`/games/${gameId}/select-winner`, data);
    return response.data.data;
  },

  finishGame: async (gameId, moderatorCardId = null) => {
    try {
      const response = await API.post(`/games/${gameId}/finish`, {
        moderatorCardId,
      });
      console.log("gameService.finishGame response:", response);
      return response.data.data;
    } catch (error) {
      console.error("gameService.finishGame error:", error);
      throw error;
    }
  },

  startGame: async (gameId) => {
    const response = await API.post(`/games/${gameId}/start`);
    return response.data.data;
  },

  updateGame: async (gameId, data) => {
    const response = await API.patch(`/games/${gameId}`, data);
    return response.data.data;
  },

  getJackpot: async () => {
    const response = await API.get("/games/jackpot");
    return response.data.data;
  },

  resetGameCounter: async () => {
    const response = await API.post("/games/reset-game-counter");
    return response.data.data;
  },

  createSequentialGames: async (data) => {
    const response = await API.post("/games/sequential", data);
    return response.data.data;
  },

  configureFutureWinners: async (winners) => {
    const response = await API.post("/games/future-winners", { winners });
    return response.data.data;
  },

  configureNextGameNumber: async (startNumber) => {
    const response = await API.post("/games/moderator-configure-next", {
      startNumber,
    });
    return response.data.data;
  },

  createFutureGames: async (data) => {
    const response = await API.post("/games/future", data);
    return response.data.data;
  },
};

export default gameService;
