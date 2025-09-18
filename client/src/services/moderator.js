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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
      const response = await API.post(`/games/${gameId}/start`);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.startGame error:",
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
      const response = await API.patch(`/games/${gameId}`, data);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.updateGame error:",
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
      const response = await API.post(`/games/${gameId}/call-number`, {
        number,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.callNumber error:",
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
      const response = await API.post("/games/reset-game-counter");
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.resetGameCounter error:",
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
      const response = await API.post("/games/configure-next", { startNumber });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.configureNextGameNumber error:",
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
      const response = await API.post("/games/configure-future-winners", {
        winners,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.configureFutureWinners error:",
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
      const response = await API.get("/games/next-pending");
      return response.data.game; // Adjusted to match response structure
    } catch (error) {
      console.error(
        "moderatorService.getNextPendingGame error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
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
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  updateJackpot: async (amount, cashierId) => {
    try {
      console.log("updateJackpot sending payload:", { amount, cashierId });
      const response = await API.patch("/games/jackpot", {
        amount: Number(amount),
        cashierId, // include this
      });
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.updateJackpot error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getCashierReport: async () => {
    try {
      console.log(
        "moderatorService.getCashierReport - Fetching cashier report"
      );
      const response = await API.get("/games/report");
      console.log("moderatorService.getCashierReport response:", response.data);
      return response.data; // Return the full report data
    } catch (error) {
      console.error(
        "moderatorService.getCashierReport error:",
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

export default moderatorService;
