import { useState, useCallback } from "react";
import gameService from "../services/game";

export const useBingoGame = () => {
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  const fetchGame = useCallback(async (id) => {
    if (!id) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.getGame(id);
      setGame(response);
      setError(null);
      return response;
    } catch (error) {
      setError(
        error.response?.data?.error || error.message || "Failed to fetch game"
      );
      throw error;
    }
  }, []);

  const callNumber = useCallback(async (gameId, data = {}) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.callNumber(gameId, data);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      setError(
        error.response?.data?.error || error.message || "Failed to call number"
      );
      throw error;
    }
  }, []);

  const checkBingo = useCallback(async (gameId, cardId) => {
    if (!gameId || !cardId) {
      setError("Invalid game ID or card ID");
      throw new Error("Invalid game ID or card ID");
    }
    try {
      const response = await gameService.checkBingo(gameId, cardId);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      setError(
        error.response?.data?.error || error.message || "Failed to check bingo"
      );
      throw error;
    }
  }, []);

  const selectWinner = useCallback(async (gameId, data) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.selectWinner(gameId, data);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to select winner"
      );
      throw error;
    }
  }, []);

  const finishGame = useCallback(async (gameId) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.finishGame(gameId);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      setError(
        error.response?.data?.error || error.message || "Failed to finish game"
      );
      throw error;
    }
  }, []);

  return {
    game,
    fetchGame,
    callNumber,
    checkBingo,
    selectWinner,
    finishGame,
    error,
  };
};
