import React, { useState, useEffect } from "react";
import ModeratorLayout from "../../components/moderator/ModeratorLayout";
import moderatorService from "../../services/moderator";

const JackpotManager = () => {
  const [jackpot, setJackpot] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState("id");
  const [days, setDays] = useState(7);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch jackpot and candidates on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const jackpotData = await moderatorService.getJackpot();
        setJackpot(jackpotData);
        const candidateData = await moderatorService.getJackpotCandidates();
        setCandidates(candidateData);
      } catch (err) {
        setError("Failed to load jackpot or candidates.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Add a new candidate
  const handleAddCandidate = async () => {
    if (!identifier) {
      setError("Please enter an identifier.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const candidate = await moderatorService.addJackpotCandidate(
        identifier,
        identifierType,
        days
      );
      setCandidates([...candidates, candidate]);
      setSuccess("Candidate added successfully!");
      setIdentifier("");
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to add candidate."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExplodeJackpot = async () => {
    if (!window.confirm("Are you sure you want to explode the jackpot?"))
      return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const result = await moderatorService.explodeJackpot();

      // Set winner info for display
      setWinner({
        identifier: result.winnerIdentifier,
        userId: result.winnerUserId,
        prize: result.prize,
      });

      setSuccess(
        `Jackpot exploded! Awarded ${result.prize} BIRR to ${
          result.winnerIdentifier
        }${result.winnerUserId ? ` (ID: ${result.winnerUserId})` : ""}.`
      );

      const jackpotData = await moderatorService.getJackpot();
      setJackpot(jackpotData);
      setCandidates([]); // Clear candidates after explosion
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to explode jackpot."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModeratorLayout>
      <div className="container mx-auto p-6 space-y-8 max-w-3xl">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Jackpot Manager
        </h2>

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading...</p>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow-md">
            {success}
          </div>
        )}

        {/* Jackpot Info */}
        {jackpot && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Current Jackpot
            </h3>
            <p className="text-lg font-medium text-indigo-600 dark:text-indigo-400">
              Amount: {jackpot.amount} BIRR
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seed: {jackpot.seed} BIRR
            </p>
          </div>
        )}

        {/* Winner Info */}
        {winner && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Jackpot Winner
            </h3>
            <p className="text-lg font-medium text-yellow-600 dark:text-yellow-400">
              {winner.name} ({winner.email})
            </p>
            <p className="text-md text-gray-600 dark:text-gray-400">
              Prize: {winner.prize} BIRR
            </p>
          </div>
        )}

        {/* Add Candidate Form */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Add Jackpot Candidate
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Identifier
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter ID, name, or phone"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Identifier Type
              </label>
              <select
                value={identifierType}
                onChange={(e) => setIdentifierType(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={loading}
              >
                <option value="id">ID</option>
                <option value="name">Name</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expiry Duration
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={loading}
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
              </select>
            </div>
            <button
              onClick={handleAddCandidate}
              disabled={loading}
              className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Adding..." : "Add Candidate"}
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Active Candidates
          </h3>
          {candidates.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No active candidates.
            </p>
          ) : (
            <ul className="space-y-3">
              {candidates.map((candidate) => (
                <li
                  key={candidate._id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
                >
                  {candidate.identifier} ({candidate.identifierType}) - Expires:{" "}
                  {new Date(candidate.expiryDate).toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Explode Jackpot Button */}
        <button
          onClick={handleExplodeJackpot}
          disabled={loading || candidates.length === 0}
          className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-200 ${
            loading || candidates.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Exploding..." : "Explode Jackpot"}
        </button>
      </div>
    </ModeratorLayout>
  );
};

export default JackpotManager;
