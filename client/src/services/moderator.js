import API from "./axios";

const moderatorService = {
  // Set a card as the winner
  setWinner: async (gameId, cardId) => {
    const response = await API.post(`/games/${gameId}/select-winner`, {
      cardId,
    });
    return response.data.data;
  },

  // Finish a game early
  finishGame: async (gameId) => {
    const response = await API.post(`/games/${gameId}/finish`);
    return response.data.data;
  },

  // Update game settings (like jackpot or moderatorWinnerCardId)
  updateGame: async (gameId, data) => {
    const response = await API.patch(`/games/${gameId}`, data);
    return response.data.data;
  },

  // Call a specific number manually (only for non-preselected games)
  callNumber: async (gameId, number) => {
    const response = await API.post(`/games/${gameId}/call-number`, { number });
    return response.data.data;
  },
};

export default moderatorService;
