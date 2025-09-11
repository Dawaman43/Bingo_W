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
      if (!response) {
        throw new Error("No game data returned");
      }
      setGame(response); // response is already game object from gameService.getGame
      setError(null);
      return response;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to fetch game";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const callNumber = useCallback(async (gameId, data = {}) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.callNumber(gameId, data.number);
      if (!response || !response.game) {
        throw new Error("No game data in response from call number");
      }
      setGame(response.game); // Set to response.game, not the entire response
      setError(null);
      return response;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to call number";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const checkBingo = useCallback(async (gameId, cardId) => {
    if (!gameId || !cardId) {
      setError("Invalid game ID or card ID");
      throw new Error("Invalid game ID or card ID");
    }
    try {
      const response = await gameService.checkBingo(gameId, cardId);
      if (!response || !response.game) {
        throw new Error("No game data in response from check bingo");
      }
      setGame(response.game); // Set to response.game
      setError(null);
      return response;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to check bingo";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const selectWinner = useCallback(async (gameId, data) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.selectWinner(gameId, data);
      if (!response || !response.game) {
        throw new Error("No game data in response from select winner");
      }
      setGame(response.game); // Set to response.game
      setError(null);
      return response;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to select winner";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const finishGame = useCallback(async (gameId) => {
    if (!gameId) {
      setError("Invalid game ID");
      throw new Error("Invalid game ID");
    }
    try {
      const response = await gameService.finishGame(gameId);
      console.log("useBingoGame.finishGame response:", response);
      if (!response) {
        throw new Error("No response data from finish game");
      }
      // Handle both cases: response.game or response as game object
      const gameData = response.game || response;
      if (!gameData || !gameData._id) {
        throw new Error("No valid game data in response from finish game");
      }
      setGame(gameData);
      setError(null);
      return { game: gameData }; // Return consistent format
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to finish game";
      setError(errorMessage);
      throw new Error(errorMessage);
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
