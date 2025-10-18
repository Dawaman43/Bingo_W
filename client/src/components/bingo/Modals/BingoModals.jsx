import React, { useEffect } from "react";
import SoundService from "../../../services/sound"; // Adjust path as needed

const BingoModals = ({
  isWinnerModalOpen,
  setIsWinnerModalOpen,
  bingoStatus,
  setBingoStatus,
  cardId,
  gameData,
  isNonWinnerModalOpen,
  setIsNonWinnerModalOpen,
  nonWinnerCardData,
  setNonWinnerCardData,
  isGameFinishedModalOpen,
  setIsGameFinishedModalOpen,
  isLoading,
  isErrorModalOpen,
  setIsErrorModalOpen,
  callError,
  setCallError,
  navigate,
  // NEW: Props for invalid card modal
  isInvalidCardModalOpen,
  setIsInvalidCardModalOpen,
}) => {
  useEffect(() => {
    if (isWinnerModalOpen) {
      SoundService.playSound("winner");
    }
  }, [isWinnerModalOpen]);

  useEffect(() => {
    if (isNonWinnerModalOpen) {
      SoundService.playSound("you_didnt_win");
    }
  }, [isNonWinnerModalOpen]);

  useEffect(() => {
    if (isGameFinishedModalOpen) {
      SoundService.playSound("game_finish");
    }
  }, [isGameFinishedModalOpen]);

  // Helper to build grid if needed (for robustness, in case data is object)
  const buildGrid = (numbers) => {
    if (
      !numbers ||
      !numbers.B ||
      !numbers.I ||
      !numbers.N ||
      !numbers.G ||
      !numbers.O
    ) {
      return Array(5)
        .fill()
        .map(() => Array(5).fill("FREE"));
    }
    const grid = [];
    for (let row = 0; row < 5; row++) {
      grid[row] = [
        numbers.B[row],
        numbers.I[row],
        numbers.N[row],
        numbers.G[row],
        numbers.O[row],
      ];
    }
    return grid;
  };

  return (
    <>
      {isWinnerModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-4 rounded-xl z-50 text-center min-w-[320px] max-w-[380px] max-h-[90vh] overflow-y-auto shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          {bingoStatus?.lateCall ? (
            <div className="space-y-3">
              <div className="text-2xl mb-3 flex items-center justify-center gap-2">
                <span className="text-yellow-400">🕒</span>
                <span className="text-yellow-400 font-bold">LATE CALL!</span>
              </div>
              <div className="bg-yellow-900/50 border border-yellow-400 p-3 rounded-lg">
                <h3 className="text-yellow-200 text-base font-semibold mb-2">
                  You Missed Your Chance! ⏰
                </h3>
                <p className="text-yellow-100 text-sm mb-2">
                  {bingoStatus.lateCallMessage ||
                    "You missed your chance to claim the win!"}
                </p>
                {bingoStatus.wouldHaveWon && (
                  <div className="text-xs text-yellow-200 space-y-1">
                    <p>
                      <strong>Would have won with:</strong>{" "}
                      {bingoStatus.wouldHaveWon.pattern?.replace("_", " ") ||
                        "unknown"}
                    </p>
                    <p>
                      <strong>On call:</strong> #
                      {bingoStatus.wouldHaveWon.callIndex}
                    </p>
                    <p>
                      <strong>With number:</strong>{" "}
                      {bingoStatus.wouldHaveWon.completingNumber}
                    </p>
                    <p className="text-yellow-300">
                      <strong>Prize:</strong> {gameData?.prizePool?.toFixed(2)}{" "}
                      BIRR
                    </p>
                  </div>
                )}
              </div>
              <button
                className="bg-yellow-600 text-white border-none px-6 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-yellow-500 w-full"
                onClick={() => {
                  setIsWinnerModalOpen(false);
                  setBingoStatus(null);
                  setCallError(null);
                }}
              >
                I Understand
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[#f0e14a] mb-3 text-xl flex items-center justify-center gap-2">
                <span className="text-2xl">🎉</span>
                <span>WINNER!</span>
              </h2>
              <p className="text-white text-base">
                Card <span className="text-[#f0e14a] font-bold">{cardId}</span>{" "}
                won with{" "}
                <span className="text-green-400 font-bold">
                  {bingoStatus?.pattern?.replace("_", " ") || "unknown"}
                </span>
                !
              </p>
              {(bingoStatus?.winnerCardNumbers || bingoStatus?.patternInfo) && (
                <div className="mt-3">
                  <h3 className="text-white text-base font-semibold mb-2 flex items-center justify-center gap-1">
                    <span className="text-green-400 text-sm">🎯</span>
                    <span className="text-sm">Winning Pattern</span>
                  </h3>
                  <div className="w-full max-w-[260px] mx-auto relative p-1 bg-black/20 rounded-lg">
                    <div className="grid grid-cols-5 gap-0.5 mb-1 justify-items-center">
                      {["B", "I", "N", "G", "O"].map((letter, index) => (
                        <div
                          key={`header-${index}`}
                          className="w-10 h-8 flex items-center justify-center text-sm font-bold text-[#f0e14a] bg-[#2a3969] rounded border border-[#f0e14a] uppercase tracking-tight"
                        >
                          {letter}
                        </div>
                      ))}
                    </div>
                    {bingoStatus?.patternInfo && (
                      <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow border border-green-400 flex items-center gap-1 whitespace-nowrap">
                          {(() => {
                            const rowNum = bingoStatus.patternInfo.rowIndex;
                            const colNum = bingoStatus.patternInfo.colIndex;
                            if (
                              rowNum !== null &&
                              !isNaN(rowNum) &&
                              rowNum >= 0 &&
                              rowNum <= 4
                            ) {
                              return <>📏 Row {rowNum + 1}</>;
                            }
                            if (
                              colNum !== null &&
                              !isNaN(colNum) &&
                              colNum >= 0 &&
                              colNum <= 4
                            ) {
                              return <>📐 Col {colNum + 1}</>;
                            }
                            return (
                              <>
                                <span className="text-[8px]">✨</span>
                                <span className="max-w-[80px] truncate">
                                  {bingoStatus.pattern
                                    ?.replace("_", " ")
                                    .toUpperCase() || "PATTERN"}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-5 gap-0.5 pt-0.5 relative">
                      {(() => {
                        let cardGrid;
                        if (
                          Array.isArray(bingoStatus.winnerCardNumbers) &&
                          Array.isArray(bingoStatus.winnerCardNumbers[0])
                        ) {
                          cardGrid = bingoStatus.winnerCardNumbers;
                        } else if (
                          bingoStatus.winnerCardNumbers &&
                          typeof bingoStatus.winnerCardNumbers === "object"
                        ) {
                          // If it's {B,I,N,G,O}, build grid
                          cardGrid = buildGrid(bingoStatus.winnerCardNumbers);
                        } else {
                          cardGrid = Array(5)
                            .fill()
                            .map(() => Array(5).fill("FREE"));
                        }
                        const winningIndices = bingoStatus.winningIndices || [];
                        const winningNumbers = bingoStatus.winningNumbers || [];
                        const otherCalledNumbers =
                          bingoStatus.otherCalledNumbers || [];
                        return cardGrid.map((row, rowIndex) =>
                          (row || Array(5).fill("FREE")).map(
                            (number, colIndex) => {
                              const cellIndex = rowIndex * 5 + colIndex;
                              const isFreeSpace = number === "FREE";
                              const isWinningCell =
                                winningIndices.includes(cellIndex);
                              const numberValue = Number(number);
                              const isWinningNumber =
                                winningNumbers.includes(numberValue);
                              const isOtherCalledNumber =
                                otherCalledNumbers.includes(numberValue);
                              const isCalled =
                                isFreeSpace ||
                                isWinningNumber ||
                                isOtherCalledNumber;
                              const displayNumber = isFreeSpace
                                ? "FREE"
                                : numberValue;
                              let cellStyle =
                                "w-10 h-10 flex items-center justify-center text-xs font-bold rounded border transition-all duration-300 shadow-sm relative overflow-hidden";
                              let textColor = "text-black";
                              if (isFreeSpace) {
                                cellStyle +=
                                  " bg-blue-600 text-white border-blue-400";
                                textColor = "text-white";
                              } else if (isWinningCell && isWinningNumber) {
                                cellStyle +=
                                  " bg-orange-500 text-white border-orange-600 shadow-orange-500/50 relative";
                                textColor =
                                  "text-white font-bold drop-shadow-sm";
                              } else if (isOtherCalledNumber) {
                                cellStyle +=
                                  " bg-blue-500 text-white border-blue-300 shadow-blue-300/30";
                                textColor = "text-white font-medium";
                              } else if (isWinningCell && !isCalled) {
                                cellStyle +=
                                  " bg-yellow-400 text-black border-yellow-600 shadow-yellow-300/30 relative";
                                textColor = "text-black font-semibold";
                              } else {
                                cellStyle +=
                                  " bg-white text-black border-gray-300 hover:bg-gray-50";
                                textColor = "text-black";
                              }
                              return (
                                <div
                                  key={`${rowIndex}-${colIndex}`}
                                  className={cellStyle}
                                >
                                  {isOtherCalledNumber && (
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-400 rounded-full"></div>
                                  )}
                                  <span
                                    className={`relative z-10 text-center ${textColor}`}
                                  >
                                    {displayNumber}
                                  </span>
                                </div>
                              );
                            }
                          )
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
              {bingoStatus?.winningNumbers &&
                bingoStatus.winningNumbers.length > 0 && (
                  <div className="bg-green-900/30 border border-green-400 p-2 rounded-lg">
                    <h4 className="text-green-300 font-bold text-xs mb-1 flex items-center gap-1">
                      <span className="text-sm">🎯</span>
                      Winning Pattern Numbers (
                      {bingoStatus.winningNumbers.length})
                    </h4>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {bingoStatus.winningNumbers.slice(0, 10).map((n) => (
                        <div
                          key={n}
                          className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-600 flex items-center gap-0.5 shadow-md"
                        >
                          <span className="text-green-200 text-[8px]">⭐</span>
                          <span className="text-white">{n}</span>
                        </div>
                      ))}
                      {bingoStatus.winningNumbers.length > 10 && (
                        <span className="bg-green-600 text-green-900 px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-400">
                          +{bingoStatus.winningNumbers.length - 10}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-400 p-2 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <div className="text-lg">💰</div>
                  <div className="text-center">
                    <p className="text-yellow-300 text-[10px] font-semibold uppercase tracking-wide">
                      PRIZE
                    </p>
                    <div className="text-lg font-bold text-yellow-400 bg-black/20 px-2 py-1 rounded border border-yellow-400">
                      {bingoStatus?.prize || "0.00"} BIRR
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="bg-gradient-to-r from-[#e9744c] to-[#f0854c] text-white border px-6 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:from-[#f0854c] hover:to-[#e9744c] hover:shadow-lg w-full flex items-center justify-center gap-1 shadow-md"
                onClick={() => {
                  setIsWinnerModalOpen(false);
                  setBingoStatus(null);
                  setCallError(null);
                }}
              >
                <span>🎊</span>
                <span>Close</span>
              </button>
            </div>
          )}
        </div>
      )}
      {isNonWinnerModalOpen && nonWinnerCardData && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-4 rounded-xl z-50 text-center min-w-[320px] max-w-[380px] max-h-[90vh] overflow-y-auto shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <div className="space-y-3">
            <h2 className="text-[#f0e14a] mb-3 text-xl flex items-center justify-center gap-2">
              <span className="text-2xl">🃏</span>
              <span>Card Check</span>
            </h2>
            <p className="text-white text-base">
              Card{" "}
              <span className="text-[#f0e14a] font-bold">
                {nonWinnerCardData.cardId}
              </span>{" "}
              is not winner
            </p>
            {nonWinnerCardData.lateCall && nonWinnerCardData.wouldHaveWon && (
              <div className="bg-yellow-900/50 border border-yellow-400 p-3 rounded-lg">
                <h3 className="text-yellow-200 text-base font-semibold mb-2">
                  Late Call! ⏰
                </h3>
                <p className="text-yellow-100 text-sm mb-2">
                  {nonWinnerCardData.lateCallMessage ||
                    "You missed your chance!"}
                </p>
                <div className="text-xs text-yellow-200 space-y-1">
                  <p>
                    <strong>Pattern:</strong>{" "}
                    {nonWinnerCardData.wouldHaveWon.pattern?.replace(
                      "_",
                      " "
                    ) || "unknown"}
                  </p>
                  <p>
                    <strong>On call:</strong> #
                    {nonWinnerCardData.wouldHaveWon.callIndex}
                  </p>
                  <p>
                    <strong>Missing number:</strong>{" "}
                    {nonWinnerCardData.wouldHaveWon.completingNumber}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3">
              <h3 className="text-white text-base font-semibold mb-2 flex items-center justify-center gap-1">
                <span className="text-green-400 text-sm">🎯</span>
                <span className="text-sm">Card Details</span>
              </h3>
              <div className="w-full max-w-[260px] mx-auto relative p-1 bg-black/20 rounded-lg">
                <div className="grid grid-cols-5 gap-0.5 mb-1 justify-items-center">
                  {["B", "I", "N", "G", "O"].map((letter, index) => (
                    <div
                      key={`header-${index}`}
                      className="w-10 h-8 flex items-center justify-center text-sm font-bold text-[#f0e14a] bg-[#2a3969] rounded border border-[#f0e14a] uppercase tracking-tight"
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                {nonWinnerCardData.patternInfo && (
                  <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow border border-green-400 flex items-center gap-1 whitespace-nowrap">
                      {(() => {
                        const rowNum = nonWinnerCardData.patternInfo.rowIndex;
                        const colNum = nonWinnerCardData.patternInfo.colIndex;
                        if (
                          rowNum !== null &&
                          !isNaN(rowNum) &&
                          rowNum >= 0 &&
                          rowNum <= 4
                        ) {
                          return <>📏 Row {rowNum + 1}</>;
                        }
                        if (
                          colNum !== null &&
                          !isNaN(colNum) &&
                          colNum >= 0 &&
                          colNum <= 4
                        ) {
                          return <>📐 Col {colNum + 1}</>;
                        }
                        return (
                          <>
                            <span className="text-[8px]">✨</span>
                            <span className="max-w-[80px] truncate">
                              {nonWinnerCardData.pattern
                                ?.replace("_", " ")
                                .toUpperCase() || "PATTERN"}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-5 gap-0.5 pt-0.5 relative">
                  {(() => {
                    let cardGrid;
                    if (
                      Array.isArray(nonWinnerCardData.cardNumbers) &&
                      Array.isArray(nonWinnerCardData.cardNumbers[0])
                    ) {
                      cardGrid = nonWinnerCardData.cardNumbers;
                    } else if (
                      nonWinnerCardData.cardNumbers &&
                      typeof nonWinnerCardData.cardNumbers === "object"
                    ) {
                      // If it's {B,I,N,G,O}, build grid
                      cardGrid = buildGrid(nonWinnerCardData.cardNumbers);
                    } else if (
                      Array.isArray(nonWinnerCardData.cardNumbers) &&
                      nonWinnerCardData.cardNumbers.length === 25
                    ) {
                      // If flat 25 (assuming row-major order), build 2D row-major grid
                      const flatNumbers = nonWinnerCardData.cardNumbers;
                      cardGrid = Array(5)
                        .fill()
                        .map(() => Array(5).fill(null));
                      for (let row = 0; row < 5; row++) {
                        for (let col = 0; col < 5; col++) {
                          const index = row * 5 + col;
                          cardGrid[row][col] =
                            flatNumbers[index] === "FREE"
                              ? "FREE"
                              : Number(flatNumbers[index]);
                        }
                      }
                    } else {
                      cardGrid = Array(5)
                        .fill()
                        .map(() => Array(5).fill("FREE"));
                    }
                    const patternIndices =
                      nonWinnerCardData.patternInfo?.selectedIndices || [];
                    const calledInPattern =
                      nonWinnerCardData.calledNumbersInPattern || [];
                    const otherCalled =
                      nonWinnerCardData.otherCalledNumbers || [];
                    const allCalled = [...calledInPattern, ...otherCalled].map(
                      Number
                    );
                    return cardGrid.map((row, rowIndex) =>
                      (row || Array(5).fill("FREE")).map((number, colIndex) => {
                        const cellIndex = rowIndex * 5 + colIndex;
                        const isFree = number === "FREE";
                        const isPatternCell =
                          patternIndices.includes(cellIndex);
                        const num = Number(number);
                        const isCalledInPattern = calledInPattern.includes(num);
                        const isOtherCalled =
                          otherCalled.includes(num) && !isCalledInPattern;
                        const displayNum = isFree ? "FREE" : num;
                        let cellStyle =
                          "w-10 h-10 flex items-center justify-center text-xs font-bold rounded border transition-all duration-300 shadow-sm relative overflow-hidden";
                        if (isFree) {
                          cellStyle +=
                            " bg-blue-600 text-white border-blue-400";
                        } else if (isCalledInPattern) {
                          cellStyle +=
                            " bg-green-600 text-white border-green-400 shadow-green-400/30 scale-[1.02]";
                        } else if (isOtherCalled) {
                          cellStyle +=
                            " bg-yellow-600 text-white border-yellow-400 shadow-yellow-400/30";
                        } else {
                          cellStyle += " bg-white text-black border-gray-300";
                        }
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={cellStyle}
                          >
                            {isCalledInPattern && (
                              <>
                                <div className="absolute inset-0 rounded opacity-20 bg-green-400 animate-pulse"></div>
                                <div className="absolute -top-[2px] -right-[2px] w-2 h-2 bg-yellow-400 rounded-full text-[6px] flex items-center justify-center font-bold text-black">
                                  *
                                </div>
                              </>
                            )}
                            <span className="relative z-10 text-center">
                              {displayNum}
                            </span>
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
              {(() => {
                const calledInPattern =
                  nonWinnerCardData.calledNumbersInPattern || [];
                const otherCalled = nonWinnerCardData.otherCalledNumbers || [];
                const allCalled = [...calledInPattern, ...otherCalled].map(
                  Number
                );
                if (allCalled.length > 0) {
                  return (
                    <div className="bg-blue-900/30 border border-blue-400 p-2 rounded-lg mt-2">
                      <h4 className="text-blue-300 font-bold text-xs mb-1 flex items-center gap-1">
                        <span className="text-sm">📞</span>
                        Called Numbers on Card ({allCalled.length})
                      </h4>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {allCalled.slice(0, 10).map((n) => (
                          <div
                            key={n}
                            className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-600 flex items-center gap-0.5 shadow-md"
                          >
                            <span className="text-blue-200 text-[8px]">🔵</span>
                            <span className="text-white">{n}</span>
                          </div>
                        ))}
                        {allCalled.length > 10 && (
                          <span className="bg-blue-600 text-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-400">
                            +{allCalled.length - 10}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <button
              className="bg-gradient-to-r from-[#e9744c] to-[#f0854c] text-white border px-6 py-2 font-bold rounded cursor-pointer text-sm transition-all duration-300 hover:from-[#f0854c] hover:to-[#e9744c] hover:shadow-lg w-full flex items-center justify-center gap-1 shadow-md"
              onClick={() => {
                setIsNonWinnerModalOpen(false);
                setNonWinnerCardData(null);
              }}
            >
              <span>✅</span>
              <span>Close</span>
            </button>
          </div>
        </div>
      )}
      {isGameFinishedModalOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1a4a] border-4 border-[#f0e14a] p-5 rounded-xl z-50 text-center min-w-[300px] shadow-[0_5px_25px_rgba(0,0,0,0.5)]">
          <h2 className="text-[#f0e14a] mb-4 text-2xl">Game Finished!</h2>
          <p className="mb-4 text-lg text-white">
            Game #{gameData?.gameNumber}: All numbers called or game ended.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              className="bg-[#e9a64c] text-black border-none px-4 py-2 font-bold rounded cursor-pointer text-sm transition-colors duration-300 hover:bg-[#f0b76a]"
              onClick={() => setIsGameFinishedModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {isErrorModalOpen && callError && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-950 border-4 border-orange-500 p-5 rounded-xl z-50 text-center min-w-[300px] shadow-2xl">
          <h2 className="text-orange-500 mb-4 text-2xl">Error</h2>
          <p className="mb-4 text-lg text-white">{callError}</p>
          <button
            className="bg-orange-400 text-black px-4 py-2 font-bold rounded text-sm hover:bg-orange-300 transition-colors duration-300"
            onClick={() => {
              setIsErrorModalOpen(false);
              setCallError(null);
              if (
                callError.includes("Invalid game ID") ||
                callError.includes("No game ID found") ||
                callError.includes("Failed to load game")
              ) {
                navigate("/create-game");
              }
            }}
          >
            Close
          </button>
        </div>
      )}
      {/* NEW: Invalid Card Modal */}
      {isInvalidCardModalOpen && callError && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-950 border-4 border-red-500 p-5 rounded-xl z-50 text-center min-w-[300px] shadow-2xl">
          <h2 className="text-red-400 mb-4 text-2xl flex items-center justify-center gap-2">
            <span>🚫</span>
            <span>Invalid Card</span>
          </h2>
          <p className="mb-4 text-lg text-white">{callError}</p>
          <button
            className="bg-red-400 text-black px-4 py-2 font-bold rounded text-sm hover:bg-red-300 transition-colors duration-300"
            onClick={() => {
              setIsInvalidCardModalOpen(false);
              setCallError(null);
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};

export default BingoModals;
