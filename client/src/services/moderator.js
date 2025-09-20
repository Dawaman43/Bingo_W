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

  // === JACKPOT CONTROL METHODS ===

  getJackpot: async () => {
    try {
      console.log("moderatorService.getJackpot - Fetching current jackpot");
      const response = await API.get("/games/jackpot");
      console.log("moderatorService.getJackpot response:", response.data);
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

  setJackpotAmount: async (amount) => {
    try {
      console.log("moderatorService.setJackpotAmount - Setting to:", amount);
      const response = await API.post("/games/jackpot/set", { amount });
      console.log("moderatorService.setJackpotAmount response:", response.data);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.setJackpotAmount error:",
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
      console.log(`moderatorService.toggleJackpot - Setting to: ${enabled}`);
      const response = await API.patch("/games/jackpot/toggle", { enabled });
      console.log("moderatorService.toggleJackpot response:", response.data);
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

  awardJackpot: async (gameId, cardId, drawAmount, message = "") => {
    try {
      console.log("moderatorService.awardJackpot:", {
        gameId,
        cardId,
        drawAmount,
        message,
      });
      const response = await API.post("/games/jackpot/award", {
        gameId,
        cardId,
        drawAmount,
        message,
      });
      console.log("moderatorService.awardJackpot response:", response.data);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.awardJackpot error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  getJackpotHistory: async () => {
    try {
      console.log("moderatorService.getJackpotHistory - Fetching history");
      const response = await API.get("/games/jackpot/history");
      console.log(
        "moderatorService.getJackpotHistory response:",
        response.data
      );
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.getJackpotHistory error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  updateJackpot: async (amount) => {
    try {
      console.warn(
        "moderatorService.updateJackpot - Using legacy method. Use setJackpotAmount instead."
      );
      console.log("moderatorService.updateJackpot:", amount);
      const response = await API.patch("/games/jackpot", { amount });
      console.log("moderatorService.updateJackpot response:", response.data);
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

  // === GAME MANAGEMENT METHODS ===

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
      const body = number ? { number } : {};
      const response = await API.post(`/games/${gameId}/call-number`, body);
      return response.data;
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

  // === ADMIN METHODS ===

  resetGameCounter: async () => {
    try {
      const response = await API.post("/games/reset-game-counter");
      return response.data;
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

  configureFutureWinners: async (payload) => {
    try {
      console.log(
        "[moderatorService.configureFutureWinners] Sending payload:",
        JSON.stringify(payload)
      );
      const response = await API.post(
        "/games/configure-future-winners",
        payload
      );
      console.log(
        "[moderatorService.configureFutureWinners] Response:",
        response.data
      );
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
      return response.data.game;
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

  getCashierReport: async () => {
    try {
      console.log(
        "moderatorService.getCashierReport - Fetching cashier report"
      );
      const response = await API.get("/games/report");
      console.log("moderatorService.getCashierReport response:", response.data);
      return response.data;
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

  getPairedCashier: async () => {
    try {
      console.log(
        "moderatorService.getPairedCashier - Fetching paired cashier"
      );
      const response = await API.get("/games/paired-cashier");
      console.log("moderatorService.getPairedCashier response:", response.data);
      return response.data.data;
    } catch (error) {
      console.error(
        "moderatorService.getPairedCashier error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  // Fetch future winners using POST
  getFutureWinners: async (cashierId) => {
    try {
      console.log(
        "[moderatorService.getFutureWinners] Fetching future winners for cashierId:",
        cashierId
      );
      const response = await API.post("/games/future-winners", {
        cashierId,
      });
      console.log(
        "[moderatorService.getFutureWinners] Response:",
        response.data
      );
      return response.data.winners || [];
    } catch (error) {
      console.error(
        "[moderatorService.getFutureWinners] Error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  // Delete a future winner by ID
  deleteFutureWinner: async (futureWinnerId) => {
    try {
      console.log(
        "[moderatorService.deleteFutureWinner] Deleting future winner with ID:",
        futureWinnerId
      );
      const response = await API.delete(
        `/games/future-winners/${futureWinnerId}`
      );
      console.log(
        "[moderatorService.deleteFutureWinner] Response:",
        response.data
      );
      return response.data;
    } catch (error) {
      console.error(
        "[moderatorService.deleteFutureWinner] Error:",
        JSON.stringify(
          error.response?.data || { message: error.message },
          null,
          2
        )
      );
      throw error;
    }
  },

  // Reconfigure a future winner by ID
  reconfigureFutureWinner: async (futureWinnerId, payload) => {
    try {
      console.log(
        "[moderatorService.reconfigureFutureWinner] Reconfiguring future winner with ID:",
        futureWinnerId,
        "Payload:",
        JSON.stringify(payload)
      );
      const response = await API.put(
        `/games/future-winners/${futureWinnerId}`,
        payload
      );
      console.log(
        "[moderatorService.reconfigureFutureWinner] Response:",
        response.data
      );
      return response.data.winner;
    } catch (error) {
      console.error(
        "[moderatorService.reconfigureFutureWinner] Error:",
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
