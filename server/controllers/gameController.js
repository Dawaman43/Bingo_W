const Game = require("../models/Game");

const createGame = async (req, res) => {
  try {
    const { betAmount, selectedCards, houseFeePercentage } = req.body;

    const H = houseFeePercentage / 100;
    const B = betAmount;
    const N = selectedCards;
    const J = B;

    const totalPot = B * N;
    const houseFee = (totalPot - J) * H;
    const prizePool = totalPot - houseFee - J;

    const game = new Game({
      betAmount: B,
      selectedCards: N,
      houseFeePercentage,
      totalPot,
      houseFee,
      prizePool,
      jackpot: J,
    });

    await game.save();

    res.status(201).json({
      message: "Game calculated successfully",
      data: game,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getAllGames = async (req, res) => {
  try {
    const games = await Game.find().sort({ createdAt: -1 });
    res.status(200).json({ data: games });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.status(200).json({ data: game });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createGame,
  getAllGames,
  getGameById,
};
