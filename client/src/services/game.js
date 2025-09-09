import API from "./axios";

const gameService = {
  createGame: async (data) => {
    const response = await API.post("/games", data);
    return response.data.data;
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

  callNumber: async (gameId, data) => {
    const response = await API.post(`/games/${gameId}/call-number`, data);
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

  finishGame: async (gameId) => {
    const response = await API.post(`/games/${gameId}/finish`);
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
};

export default gameService;
