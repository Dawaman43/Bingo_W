import { useState } from "react";
import gameService from "../services/game";

export const useBingoGame = () => {
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  const fetchGame = async (id) => {
    if (!id || id === "undefined") {
      setError("Invalid gameId: ID is undefined");
      console.error("fetchGame: Invalid gameId:", id);
      return;
    }
    try {
      const response = await gameService.getGame(id);
      console.log("fetchGame response:", response);
      setGame(response);
      setError(null);
    } catch (error) {
      console.error(
        "Error fetching game:",
        error.response?.data || error.message
      );
      setError(
        error.response?.data?.error || error.message || "Failed to fetch game"
      );
      throw error;
    }
  };

  const callNumber = async (gameId, data = {}) => {
    if (!gameId || gameId === "undefined") {
      setError("Invalid gameId: ID is undefined");
      console.error("callNumber: Invalid gameId:", gameId);
      throw new Error("Invalid gameId");
    }
    try {
      const response = await gameService.callNumber(gameId, data);
      console.log("callNumber response:", response);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      console.error(
        "Error calling number:",
        error.response?.data || error.message
      );
      setError(
        error.response?.data?.error || error.message || "Failed to call number"
      );
      throw error;
    }
  };

  const checkBingo = async (gameId, cardId) => {
    if (!gameId || gameId === "undefined") {
      setError("Invalid gameId: ID is undefined");
      console.error("checkBingo: Invalid gameId:", gameId);
      throw new Error("Invalid gameId");
    }
    if (!cardId) {
      setError("Invalid cardId: ID is undefined");
      console.error("checkBingo: Invalid cardId:", cardId);
      throw new Error("Invalid cardId");
    }
    try {
      const response = await gameService.checkBingo(gameId, cardId);
      console.log("checkBingo response:", response);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      console.error(
        "Error checking bingo:",
        error.response?.data || error.message
      );
      setError(
        error.response?.data?.error || error.message || "Failed to check bingo"
      );
      throw error;
    }
  };

  const selectWinner = async (gameId, data) => {
    if (!gameId || gameId === "undefined") {
      setError("Invalid gameId: ID is undefined");
      console.error("selectWinner: Invalid gameId:", gameId);
      throw new Error("Invalid gameId");
    }
    try {
      const response = await gameService.selectWinner(gameId, data);
      console.log("selectWinner response:", response);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      console.error(
        "Error selecting winner:",
        error.response?.data || error.message
      );
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to select winner"
      );
      throw error;
    }
  };

  const finishGame = async (gameId) => {
    if (!gameId || gameId === "undefined") {
      setError("Invalid gameId: ID is undefined");
      console.error("finishGame: Invalid gameId:", gameId);
      throw new Error("Invalid gameId");
    }
    try {
      const response = await gameService.finishGame(gameId);
      console.log("finishGame response:", response);
      setGame(response.game || response);
      setError(null);
      return response;
    } catch (error) {
      console.error(
        "Error finishing game:",
        error.response?.data || error.message
      );
      setError(
        error.response?.data?.error || error.message || "Failed to finish game"
      );
      throw error;
    }
  };

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
