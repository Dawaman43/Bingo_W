import API from "./axios";

const moderatorService = {
  setWinnerById: async (gameId, cardId) => {
    try {
      const response = await API.post(`/games/${gameId}/select-winner`, {
        cardId,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.setWinnerById error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  setWinnerByNumber: async (gameNumber, cardId) => {
    try {
      const response = await API.post(`/games/select-winner`, {
        gameNumber,
        cardId,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.setWinnerByNumber error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  finishGame: async (gameId) => {
    try {
      const response = await API.post(`/games/${gameId}/finish`);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.finishGame error:",
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
        "moderatorService.startGame error:",
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
        "moderatorService.updateGame error:",
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
        "moderatorService.callNumber error:",
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
        "moderatorService.resetGameCounter error:",
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
        "moderatorService.configureNextGameNumber error:",
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
        "moderatorService.configureFutureWinners error:",
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
        "moderatorService.getNextPendingGame error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};

export default moderatorService;
