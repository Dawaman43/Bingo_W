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

  addJackpotCandidate: async (identifier, identifierType, days) => {
    try {
      const response = await API.post("/games/jackpot/candidates", {
        identifier,
        identifierType,
        days,
      });
      return response.data.candidate;
    } catch (error) {
      console.error(
        "moderatorService.addJackpotCandidate error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  explodeJackpot: async () => {
    try {
      const response = await API.post("/games/jackpot/explode");
      return {
        winnerUserId: response.data.winnerUserId,
        winnerName: response.data.winnerName,
        winnerEmail: response.data.winnerEmail,
        prize: response.data.prize,
        remainingJackpot: response.data.remainingJackpot,
      };
    } catch (error) {
      console.error(
        "moderatorService.explodeJackpot error:",
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
        "moderatorService.getJackpot error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getJackpotCandidates: async () => {
    try {
      const response = await API.get("/games/jackpot/candidates");
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.getJackpotCandidates error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  toggleJackpot: async (enabled) => {
    try {
      const response = await API.patch("/games/jackpot", { enabled });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.toggleJackpot error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updateJackpot: async (amount) => {
    try {
      console.log("updateJackpot sending payload:", { amount });
      const response = await API.patch("/games/jackpot", {
        amount: Number(amount),
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.updateJackpot error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};

export default moderatorService;
