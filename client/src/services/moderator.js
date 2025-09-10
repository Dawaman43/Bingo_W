import API from "./axios";

const moderatorService = {
  setWinnerById: async (gameId, cardId) => {
    const response = await API.post(`/games/${gameId}/select-winner`, {
      cardId,
    });
    return response.data.data;
  },

  setWinnerByNumber: async (gameNumber, cardId) => {
    const response = await API.post(`/games/select-winner`, {
      gameNumber,
      cardId,
    });
    return response.data.data;
  },

  finishGame: async (gameId) => {
    const response = await API.post(`/games/${gameId}/finish`);
    return response.data.data;
  },

  startGame: async (gameId) => {
    const response = await API.post(`/games/${gameId}/start`);
    return response.data.data;
  },

  updateGame: async (gameId, data) => {
    const response = await API.patch(`/games/${gameId}`, data);
    return response.data.data;
  },

  callNumber: async (gameId, number) => {
    const response = await API.post(`/games/${gameId}/call-number`, { number });
    return response.data.data;
  },

  resetGameCounter: async () => {
    const response = await API.post("/games/reset-game-counter");
    return response.data.data;
  },

  configureNextGameNumber: async (startNumber) => {
    const response = await API.post("/games/moderator-configure-next", {
      startNumber,
    });
    return response.data.data;
  },
};

export default moderatorService;
