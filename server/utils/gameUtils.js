import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";
import Counter from "../models/Counter.js";
import JackpotLog from "../models/JackpotLog.js";
import GameLog from "../models/GameLog.js";
import JackpotCandidate from "../models/JackpotCandidate.js";
import User from "../models/User.js";

// --- Helper Functions ---

/**
 * Creates a marked grid for the card based on called numbers.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @returns {Array<Array<boolean>>} 5x5 grid of marked statuses
 */
// utils/gameUtils.js
export const getMarkedGrid = (cardNumbers, calledNumbers) => {
  console.log(`[getMarkedGrid] cardNumbers:`, cardNumbers);
  console.log(`[getMarkedGrid] calledNumbers:`, calledNumbers);
  if (
    !Array.isArray(cardNumbers) ||
    cardNumbers.length !== 5 ||
    cardNumbers.some((row) => !Array.isArray(row) || row.length !== 5) ||
    !Array.isArray(calledNumbers)
  ) {
    console.error(`[getMarkedGrid] Invalid input format`);
    return Array(5)
      .fill()
      .map(() => Array(5).fill(false));
  }
  const normalizedCalled = calledNumbers.map(Number); // Ensure calledNumbers are numbers
  const marked = cardNumbers.map((row, i) =>
    row.map((cell, j) => {
      if (i === 2 && j === 2) return null; // Free space
      return normalizedCalled.includes(Number(cell));
    })
  );
  console.log(`[getMarkedGrid] Marked grid:`, marked);
  return marked;
};

// utils/gameUtils.js - Updated helper functions

/**
 * Get specific line information for the last called number
 */
export const getSpecificLineInfo = (cardNumbers, pattern, lastCalledNumber) => {
  if (!lastCalledNumber) return null;

  const targetStr = String(lastCalledNumber);
  const flatNumbers = cardNumbers.flat();
  const targetIndex = flatNumbers.findIndex((num) => String(num) === targetStr);

  if (targetIndex === -1) return null;

  const row = Math.floor(targetIndex / 5);
  const col = targetIndex % 5;

  console.log(
    `[getSpecificLineInfo] lastCalledNumber ${lastCalledNumber} found at row ${row}, col ${col}`
  );

  switch (pattern) {
    case "horizontal_line":
      return { lineType: "row", lineIndex: row };

    case "vertical_line":
      return { lineType: "column", lineIndex: col };

    case "main_diagonal":
      if (row === col) {
        return { lineType: "main_diagonal" };
      }
      return null;

    case "other_diagonal":
      if (row + col === 4) {
        return { lineType: "other_diagonal" };
      }
      return null;

    case "four_corners_center":
      const positions = [
        { row: 0, col: 0 }, // top-left
        { row: 0, col: 4 }, // top-right
        { row: 4, col: 0 }, // bottom-left
        { row: 4, col: 4 }, // bottom-right
        { row: 2, col: 2 }, // center
      ];
      const position = positions.find((p) => p.row === row && p.col === col);
      if (position) {
        return { lineType: "four_corners_center" };
      }
      return null;

    case "inner_corners":
      const innerPositions = [
        { row: 1, col: 1 }, // I2
        { row: 1, col: 3 }, // O2
        { row: 3, col: 1 }, // I4
        { row: 3, col: 3 }, // O4
      ];
      const innerPosition = innerPositions.find(
        (p) => p.row === row && p.col === col
      );
      if (innerPosition) {
        return { lineType: "inner_corners" };
      }
      return null;

    default:
      return null;
  }
};

/**
 * Check if a specific line was complete with given called numbers
 */
export const checkSpecificLineCompletion = (
  cardNumbers,
  calledNumbers,
  pattern,
  lineInfo
) => {
  const markedGrid = getMarkedGrid(cardNumbers, calledNumbers);

  console.log(
    `[checkSpecificLineCompletion] Checking ${lineInfo.lineType} for pattern ${pattern}`
  );

  const isLineComplete = (markedGrid, lineType) => {
    switch (lineType) {
      case "row":
        if (lineInfo.lineIndex !== undefined) {
          const rowComplete = markedGrid[lineInfo.lineIndex].every(
            (cell) => cell === true || cell === null
          );
          console.log(
            `[checkSpecificLineCompletion] Row ${
              lineInfo.lineIndex
            }: ${markedGrid[lineInfo.lineIndex].join(
              ", "
            )} → complete: ${rowComplete}`
          );
          return rowComplete;
        }
        return false;

      case "column":
        if (lineInfo.lineIndex !== undefined) {
          const colComplete = [0, 1, 2, 3, 4].every(
            (rowIndex) =>
              markedGrid[rowIndex][lineInfo.lineIndex] === true ||
              markedGrid[rowIndex][lineInfo.lineIndex] === null
          );
          console.log(
            `[checkSpecificLineCompletion] Col ${lineInfo.lineIndex}: [${[
              0, 1, 2, 3, 4,
            ]
              .map((r) => markedGrid[r][lineInfo.lineIndex])
              .join(", ")}] → complete: ${colComplete}`
          );
          return colComplete;
        }
        return false;

      case "main_diagonal":
        const mainDiagComplete = [0, 1, 2, 3, 4].every(
          (i) => markedGrid[i][i] === true || markedGrid[i][i] === null
        );
        console.log(
          `[checkSpecificLineCompletion] Main diagonal: [${[0, 1, 2, 3, 4]
            .map((i) => markedGrid[i][i])
            .join(", ")}] → complete: ${mainDiagComplete}`
        );
        return mainDiagComplete;

      case "other_diagonal":
        const otherDiagComplete = [0, 1, 2, 3, 4].every(
          (i) => markedGrid[i][4 - i] === true || markedGrid[i][4 - i] === null
        );
        console.log(
          `[checkSpecificLineCompletion] Other diagonal: [${[0, 1, 2, 3, 4]
            .map((i) => markedGrid[i][4 - i])
            .join(", ")}] → complete: ${otherDiagComplete}`
        );
        return otherDiagComplete;

      case "four_corners_center":
        const cornersComplete = [
          markedGrid[0][0],
          markedGrid[0][4],
          markedGrid[4][0],
          markedGrid[4][4],
          markedGrid[2][2],
        ].every((cell) => cell === true || cell === null);
        console.log(
          `[checkSpecificLineCompletion] Four corners: [${[
            markedGrid[0][0],
            markedGrid[0][4],
            markedGrid[4][0],
            markedGrid[4][4],
            markedGrid[2][2],
          ].join(", ")}] → complete: ${cornersComplete}`
        );
        return cornersComplete;

      case "inner_corners":
        const innerComplete = [
          markedGrid[1][1],
          markedGrid[1][3],
          markedGrid[3][1],
          markedGrid[3][3],
        ].every((cell) => cell === true);
        console.log(
          `[checkSpecificLineCompletion] Inner corners: [${[
            markedGrid[1][1],
            markedGrid[1][3],
            markedGrid[3][1],
            markedGrid[3][3],
          ].join(", ")}] → complete: ${innerComplete}`
        );
        return innerComplete;

      default:
        console.log(
          `[checkSpecificLineCompletion] Unknown line type: ${lineType}`
        );
        return false;
    }
  };

  return isLineComplete(markedGrid, lineInfo.lineType);
};
// 🔑 Check if a card would have won (for late call detection)
export const checkIfCardWouldHaveWon = async (
  cardNumbers,
  calledNumbers,
  patternsToCheck,
  lastCalledNumber
) => {
  const validBingoPatterns = [];
  let winningPattern = null;

  for (const pattern of patternsToCheck) {
    try {
      // Get specific line info for this pattern
      const specificLineInfo = getSpecificLineInfo(
        cardNumbers,
        pattern,
        lastCalledNumber
      );

      if (!specificLineInfo) {
        continue; // Last number not in this pattern
      }

      // Check if the specific line is complete NOW
      const currentLineComplete = checkSpecificLineCompletion(
        cardNumbers,
        calledNumbers,
        pattern,
        specificLineInfo
      );

      if (!currentLineComplete) {
        continue; // Specific line not complete
      }

      // For late call detection, we don't check previous state
      // Just confirm it would have been a valid win
      validBingoPatterns.push(pattern);

      if (!winningPattern) {
        winningPattern = pattern; // Take first valid pattern
      }
    } catch (err) {
      console.error(
        `[checkIfCardWouldHaveWon] Error with pattern ${pattern}:`,
        err
      );
    }
  }

  return {
    isBingo: validBingoPatterns.length > 0,
    winningPattern: winningPattern || null,
    validBingoPatterns,
  };
};

export const detectLateCallOpportunity = async (
  cardNumbers,
  calledNumbers,
  calledNumbersLog,
  patterns
) => {
  let hasMissedOpportunity = false;
  let earliestCallIndex = Infinity;
  let details = null;

  for (const pattern of patterns) {
    const [isComplete, lineInfo] = checkCardBingo(
      cardNumbers,
      calledNumbers,
      pattern
    );
    if (!isComplete) continue;

    // Use lineInfo to determine specific line indices for patterns like horizontal_line or vertical_line
    const specificLineIndices =
      (pattern === "horizontal_line" || pattern === "vertical_line") &&
      lineInfo?.lineIndex != null
        ? [lineInfo.lineIndex]
        : [];

    // Use includeMarked: true to get all numbers in the pattern
    const { numbers: patternNumbers } = getNumbersForPattern(
      cardNumbers,
      pattern,
      calledNumbers,
      true, // Select specific line if applicable
      specificLineIndices, // Pass the line index from checkCardBingo
      true // Include marked numbers to get the actual pattern numbers
    );

    const patternNumbersNumeric = patternNumbers
      .map(Number)
      .filter((num) => !isNaN(num) && num !== "FREE");
    if (patternNumbersNumeric.length === 0) {
      console.warn(
        `[detectLateCallOpportunity] No valid numbers for pattern ${pattern}`
      );
      continue;
    }

    // Find the call indices for the pattern numbers
    const calledPatternNumbers = calledNumbersLog.filter((log) =>
      patternNumbersNumeric.includes(log.number)
    );
    if (calledPatternNumbers.length === patternNumbersNumeric.length) {
      const callIndices = calledPatternNumbers.map((log) =>
        calledNumbers.indexOf(log.number)
      );
      if (callIndices.length === 0) continue;

      const completingCallIndex = Math.max(...callIndices);
      const completingNumber = calledNumbers[completingCallIndex];

      // Ensure the pattern wasn't completed by the last call
      const lastCalledNumber = calledNumbers[calledNumbers.length - 1];
      if (completingCallIndex < calledNumbers.length - 1) {
        // Late call: pattern was completed before the last call
        hasMissedOpportunity = true;
        if (completingCallIndex < earliestCallIndex) {
          earliestCallIndex = completingCallIndex;
          details = {
            pattern,
            completingNumber,
            callIndex: completingCallIndex + 1,
            validPatterns: [pattern],
            rowIndex: lineInfo?.lineIndex != null ? lineInfo.lineIndex : null,
          };
        }
      }
    }
  }

  if (hasMissedOpportunity) {
    const message = `You won before with ${details.pattern.replace(
      "_",
      " "
    )} pattern${
      details.rowIndex != null ? ` on row ${details.rowIndex + 1}` : ""
    } on call #${details.callIndex} (number ${details.completingNumber})`;
    console.log("[detectLateCallOpportunity] Result:", {
      hasMissedOpportunity,
      message,
      details,
      earliestCallIndex,
    });
    return {
      hasMissedOpportunity,
      message,
      details,
      earliestCallIndex,
    };
  }

  return { hasMissedOpportunity: false };
};

const findCompleteRow = (cardNumbers, calledNumbers) => {
  for (let row = 0; row < 5; row++) {
    const isRowComplete = cardNumbers[row].every(
      (num) => num === "FREE" || calledNumbers.includes(num)
    );
    if (isRowComplete) return row;
  }
  return 0;
};
export const checkCardBingo = (
  cardNumbers,
  calledNumbers,
  pattern,
  lastCalledNumber = null
) => {
  console.log(
    `[checkCardBingo] Checking pattern: ${pattern}, lastCalledNumber: ${lastCalledNumber}`
  );

  const markedGrid = getMarkedGrid(cardNumbers, calledNumbers);

  // 🔑 For line patterns, get the specific line info if lastCalledNumber provided
  const specificLineInfo = lastCalledNumber
    ? getSpecificLineInfo(cardNumbers, pattern, lastCalledNumber)
    : null;

  switch (pattern) {
    case "four_corners_center":
      const cornersComplete = [
        markedGrid[0][0],
        markedGrid[0][4],
        markedGrid[4][0],
        markedGrid[4][4],
        markedGrid[2][2],
      ].every((cell) => cell === true || cell === null);

      console.log(
        `[checkCardBingo] Four corners check: isBingo=${cornersComplete}`
      );
      return [cornersComplete, pattern];

    case "inner_corners":
      const innerCornersComplete = [
        markedGrid[1][1],
        markedGrid[1][3],
        markedGrid[3][1],
        markedGrid[3][3],
      ].every((cell) => cell === true);

      console.log(
        `[checkCardBingo] Inner corners check: isBingo=${innerCornersComplete}`
      );
      return [innerCornersComplete, pattern];

    case "main_diagonal":
      const mainDiagonalComplete = [0, 1, 2, 3, 4]
        .map((i) => markedGrid[i][i])
        .every((cell) => cell === true || cell === null);

      console.log(
        `[checkCardBingo] Main diagonal check: isBingo=${mainDiagonalComplete}`
      );
      return [mainDiagonalComplete, pattern];

    case "other_diagonal":
      const otherDiagonalComplete = [0, 1, 2, 3, 4]
        .map((i) => markedGrid[i][4 - i])
        .every((cell) => cell === true || cell === null);

      console.log(
        `[checkCardBingo] Other diagonal check: isBingo=${otherDiagonalComplete}`
      );
      return [otherDiagonalComplete, pattern];

    case "horizontal_line":
      let horizontalBingo = false;

      // 🔑 If we have lastCalledNumber, check ONLY the specific row containing it
      if (
        lastCalledNumber &&
        specificLineInfo &&
        specificLineInfo.lineType === "row"
      ) {
        const specificRowComplete = markedGrid[
          specificLineInfo.lineIndex
        ].every((cell) => cell === true || cell === null);
        horizontalBingo = specificRowComplete;
        console.log(
          `[checkCardBingo] Horizontal line check (specific row ${specificLineInfo.lineIndex}): isBingo=${horizontalBingo}`
        );
        return [horizontalBingo, pattern];
      }

      // If no specific line, check if ANY row is complete (for previous state checks)
      for (let row = 0; row < 5; row++) {
        if (markedGrid[row].every((cell) => cell === true || cell === null)) {
          horizontalBingo = true;
          console.log(
            `[checkCardBingo] Horizontal line check (any row ${row}): isBingo=${horizontalBingo}`
          );
          break;
        }
      }

      console.log(
        `[checkCardBingo] Horizontal line result: isBingo=${horizontalBingo}`
      );
      return [horizontalBingo, pattern];

    case "vertical_line":
      let verticalBingo = false;

      // 🔑 If we have lastCalledNumber, check ONLY the specific column containing it
      if (
        lastCalledNumber &&
        specificLineInfo &&
        specificLineInfo.lineType === "column"
      ) {
        const specificColComplete = [0, 1, 2, 3, 4].every(
          (rowIndex) =>
            markedGrid[rowIndex][specificLineInfo.lineIndex] === true ||
            markedGrid[rowIndex][specificLineInfo.lineIndex] === null
        );
        verticalBingo = specificColComplete;
        console.log(
          `[checkCardBingo] Vertical line check (specific col ${specificLineInfo.lineIndex}): isBingo=${verticalBingo}`
        );
        return [verticalBingo, pattern];
      }

      // If no specific line, check if ANY column is complete (for previous state checks)
      for (let col = 0; col < 5; col++) {
        if (
          [0, 1, 2, 3, 4].every(
            (rowIndex) =>
              markedGrid[rowIndex][col] === true ||
              markedGrid[rowIndex][col] === null
          )
        ) {
          verticalBingo = true;
          console.log(
            `[checkCardBingo] Vertical line check (any col ${col}): isBingo=${verticalBingo}`
          );
          break;
        }
      }

      console.log(
        `[checkCardBingo] Vertical line result: isBingo=${verticalBingo}`
      );
      return [verticalBingo, pattern];

    default:
      console.warn(`[checkCardBingo] Unknown pattern: ${pattern}`);
      return [false, pattern];
  }
};

/**
 * Extracts numbers from a card based on the specified pattern, prioritizing specific lines when requested.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {string} pattern - Pattern type
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {boolean} selectSpecificLine - Whether to select numbers from specific lines
 * @param {number[]} [targetIndices] - Specific line indices to target
 * @returns {{ numbers: string[], selectedIndices: number[] }} Array of numbers for the pattern and selected line indices
 */
export const getNumbersForPattern = (
  cardNumbers,
  pattern,
  calledNumbers = [],
  selectSpecificLine = false,
  targetIndices = [],
  includeMarked = false,
  lastCalledNumber = null // 👈 NEW: Pass last called number to identify winning line
) => {
  // ✅ SAFETY: Block "all" — should never reach here
  if (pattern === "all") {
    console.error(
      `[getNumbersForPattern] ❌ CRITICAL: "all" pattern passed directly. Convert to real pattern first.`
    );
    throw new Error(`"all" pattern is forbidden here. Use a real pattern.`);
  }

  console.log(
    `[getNumbersForPattern] 🟡 START — Pattern: "${pattern}", Called: [${calledNumbers.join(
      ", "
    )}], includeMarked: ${includeMarked}, lastCalledNumber: ${lastCalledNumber}`
  );

  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
    console.warn("[getNumbersForPattern] ❌ Invalid or empty cardNumbers");
    return { numbers: [], selectedIndices: [] };
  }

  // Convert all to strings for safe comparison
  const grid = cardNumbers.map((row) =>
    Array.isArray(row) ? row.map((num) => String(num)) : []
  );

  const numbers = [];
  const selectedIndices = [];

  // 👇 Filter logic now depends on includeMarked
  const filterFn = includeMarked
    ? (n) => n !== "FREE" // Return all non-FREE numbers in pattern
    : (n) => n !== "FREE" && !calledNumbers.includes(Number(n)); // Only unmarked

  console.log(`[getNumbersForPattern] 🟦 Grid prepared:`, grid);

  // 🔑 NEW: Helper function to find line containing lastCalledNumber
  const findLineContainingNumber = (lastCalledNumber, grid) => {
    if (!lastCalledNumber) return null;

    const lastCalledStr = String(lastCalledNumber);

    // Check rows first (horizontal lines)
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col] === lastCalledStr) {
          return { type: "row", index: row, col: col };
        }
      }
    }

    // Check columns (vertical lines)
    for (let col = 0; col < grid[0].length; col++) {
      for (let row = 0; row < grid.length; row++) {
        if (grid[row][col] === lastCalledStr) {
          return { type: "col", index: col, row: row };
        }
      }
    }

    return null;
  };

  // 🔑 NEW: Helper function to check if a line is complete (all numbers called)
  const isLineComplete = (lineNumbers, calledNumbers) => {
    return lineNumbers.every(
      (num) => num === "FREE" || calledNumbers.includes(Number(num))
    );
  };

  switch (pattern) {
    case "four_corners_center":
      const cornersAndCenter = [
        grid[0][0], // top-left (B1)
        grid[0][4], // top-right (O1)
        grid[4][0], // bottom-left (B5)
        grid[4][4], // bottom-right (O5)
        grid[2][2], // center (N3)
      ].filter(filterFn);
      numbers.push(...cornersAndCenter);
      selectedIndices.push(0, 4, 20, 24, 12); // Fixed indices: 0,4,20,24,12
      console.log(
        `[getNumbersForPattern] ✅ Pattern "four_corners_center" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "inner_corners":
      const innerCorners = [
        grid[1][1], // I2 (index 6)
        grid[1][3], // O2 (index 8)
        grid[3][1], // I4 (index 16)
        grid[3][3], // O4 (index 18)
      ].filter(filterFn);
      numbers.push(...innerCorners);
      selectedIndices.push(6, 8, 16, 18); // Fixed indices for I2, O2, I4, O4
      console.log(
        `[getNumbersForPattern] ✅ Pattern "inner_corners" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "main_diagonal":
      const mainDiag = [0, 1, 2, 3, 4].map((i) => grid[i][i]).filter(filterFn);
      numbers.push(...mainDiag);
      selectedIndices.push(0, 6, 12, 18, 24); // Fixed diagonal: B1, I2, N3, G4, O5
      console.log(
        `[getNumbersForPattern] ✅ Pattern "main_diagonal" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "other_diagonal":
      const otherDiag = [0, 1, 2, 3, 4]
        .map((i) => grid[i][4 - i])
        .filter(filterFn);
      numbers.push(...otherDiag);
      selectedIndices.push(4, 8, 12, 16, 20); // Fixed diagonal: O1, G2, N3, I4, B5
      console.log(
        `[getNumbersForPattern] ✅ Pattern "other_diagonal" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "horizontal_line":
      let selectedRow = null;

      // 🔑 STEP 1: If we have lastCalledNumber, find the exact row that contains it
      if (lastCalledNumber) {
        const lineInfo = findLineContainingNumber(lastCalledNumber, grid);
        if (lineInfo && lineInfo.type === "row") {
          selectedRow = lineInfo.index;
          console.log(
            `[getNumbersForPattern] 🎯 Found lastCalledNumber ${lastCalledNumber} in row ${selectedRow}`
          );
        }
      }

      // 🔑 STEP 2: If no specific row found, check for complete lines
      if (!selectedRow) {
        // Check each row for completion
        for (let row = 0; row < grid.length; row++) {
          const rowNumbers = grid[row];
          if (isLineComplete(rowNumbers, calledNumbers)) {
            selectedRow = row;
            console.log(
              `[getNumbersForPattern] ✅ Found complete row ${row}: [${rowNumbers.join(
                ", "
              )}]`
            );
            break; // Take first complete row
          }
        }
      }

      // 🔑 STEP 3: If still no row found, use specified target or first row as fallback
      if (!selectedRow && selectSpecificLine && targetIndices.length > 0) {
        selectedRow = targetIndices[0];
        console.log(
          `[getNumbersForPattern] 📍 Using specified row ${selectedRow}`
        );
      }

      if (!selectedRow && grid.length > 0) {
        selectedRow = 0; // Default to first row
        console.log(
          `[getNumbersForPattern] ⚠️ No complete/specific row found, using default row 0`
        );
      }

      // 🔑 STEP 4: Process the selected row
      if (
        selectedRow !== null &&
        selectedRow >= 0 &&
        selectedRow < grid.length
      ) {
        const rowNumbers = grid[selectedRow].filter(filterFn);
        numbers.push(...rowNumbers);
        for (let j = 0; j < 5; j++) {
          if (filterFn(grid[selectedRow][j])) {
            selectedIndices.push(selectedRow * 5 + j);
          }
        }
        console.log(
          `[getNumbersForPattern] ✅ Pattern "horizontal_line" (row ${selectedRow}) → Numbers: [${numbers.join(
            ", "
          )}], Indices: [${selectedIndices.join(", ")}]`
        );
      } else {
        console.warn(
          "[getNumbersForPattern] ❌ No valid row found for horizontal_line"
        );
      }
      break;

    case "vertical_line":
      let selectedCol = null;

      // 🔑 STEP 1: If we have lastCalledNumber, find the exact column that contains it
      if (lastCalledNumber) {
        const lineInfo = findLineContainingNumber(lastCalledNumber, grid);
        if (lineInfo && lineInfo.type === "col") {
          selectedCol = lineInfo.index;
          console.log(
            `[getNumbersForPattern] 🎯 Found lastCalledNumber ${lastCalledNumber} in column ${selectedCol}`
          );
        }
      }

      // 🔑 STEP 2: If no specific column found, check for complete lines
      if (!selectedCol) {
        // Check each column for completion
        for (let col = 0; col < grid[0].length; col++) {
          const colNumbers = [0, 1, 2, 3, 4].map((row) => grid[row][col]);
          if (isLineComplete(colNumbers, calledNumbers)) {
            selectedCol = col;
            console.log(
              `[getNumbersForPattern] ✅ Found complete column ${col}: [${colNumbers.join(
                ", "
              )}]`
            );
            break; // Take first complete column
          }
        }
      }

      // 🔑 STEP 3: If still no column found, use specified target or first column as fallback
      if (!selectedCol && selectSpecificLine && targetIndices.length > 0) {
        selectedCol = targetIndices[0];
        console.log(
          `[getNumbersForPattern] 📍 Using specified column ${selectedCol}`
        );
      }

      if (!selectedCol && grid[0] && grid[0].length > 0) {
        selectedCol = 0; // Default to first column
        console.log(
          `[getNumbersForPattern] ⚠️ No complete/specific column found, using default column 0`
        );
      }

      // 🔑 STEP 4: Process the selected column
      if (
        selectedCol !== null &&
        selectedCol >= 0 &&
        selectedCol < grid[0].length
      ) {
        const colNumbers = [0, 1, 2, 3, 4]
          .map((_, row) => grid[row][selectedCol])
          .filter(filterFn);
        numbers.push(...colNumbers);
        for (let i = 0; i < 5; i++) {
          if (filterFn(grid[i][selectedCol])) {
            selectedIndices.push(i * 5 + selectedCol);
          }
        }
        console.log(
          `[getNumbersForPattern] ✅ Pattern "vertical_line" (col ${selectedCol}) → Numbers: [${numbers.join(
            ", "
          )}], Indices: [${selectedIndices.join(", ")}]`
        );
      } else {
        console.warn(
          "[getNumbersForPattern] ❌ No valid column found for vertical_line"
        );
      }
      break;

    default:
      console.warn(
        `[getNumbersForPattern] ❌ Unknown pattern: "${pattern}" — returning empty`
      );
      return { numbers: [], selectedIndices: [] };
  }

  const result = {
    numbers: numbers.map(String),
    selectedIndices,
  };

  console.log(`[getNumbersForPattern] 🟢 END — Returning:`, result);
  return result;
};

/**
 * Get the next sequence number for a specific counter and cashier.
 * @param {String} counterType - e.g., "gameNumber" or "cardId"
 * @param {mongoose.Types.ObjectId} cashierId - The cashier's _id
 * @param {mongoose.ClientSession} session - Optional mongoose session for transactions
 * @returns {Number} - The next sequence number
 */
export const getNextSequence = async (counterName) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

/**
 * Gets the next game number atomically, ensuring no gaps by checking existing games.
 * @param {number} [startFromGameNumber] - Optional starting game number
 * @returns {Promise<number>} The next game number
 */
export const getNextGameNumber = async (startFromGameNumber = null) => {
  console.log("[getNextGameNumber] Starting game number assignment");
  console.log(
    "[getNextGameNumber] Requested startFromGameNumber:",
    startFromGameNumber
  );

  const allGames = await Game.find().sort({ gameNumber: 1 }).lean();
  const existingNumbers = new Set(allGames.map((g) => g.gameNumber));

  if (startFromGameNumber && !existingNumbers.has(startFromGameNumber)) {
    console.log(
      "[getNextGameNumber] Using provided startFromGameNumber:",
      startFromGameNumber
    );
    await Counter.findOneAndUpdate(
      { _id: "gameNumber" },
      { $max: { seq: startFromGameNumber } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return startFromGameNumber;
  }

  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }

  await Counter.findOneAndUpdate(
    { _id: "gameNumber" },
    { seq: nextNumber },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return nextNumber;
};

/**
 * Gets the current game number without incrementing.
 * @returns {Promise<number>} The current game number
 */
export const getCurrentGameNumber = async () => {
  const counter = await Counter.findById("gameNumber").lean();
  if (!counter) {
    console.log("[getCurrentGameNumber] No counter found, returning 1");
    return 1;
  }
  return counter.seq;
};

const getRandomNumber = (calledNumbers, exclude = []) => {
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n) && !exclude.includes(n)
  );
  if (availableNumbers.length === 0) return null;
  return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
};

/**
 * Creates a mixed sequence of forced and random numbers
 * @param {number[]} forcedNums - Numbers needed for the winner card to win
 * @param {number[]} calledNumbers - Already called numbers
 * @returns {number[]} A mixed sequence with forced numbers distributed naturally
 */
export const createMixedCallSequence = (forcedNums, calledNumbers) => {
  const shuffledForced = [...forcedNums].sort(() => Math.random() - 0.5);
  const numForced = shuffledForced.length;
  const totalCalls = Math.max(numForced, Math.floor(Math.random() * 6) + 20);
  const numRandom = totalCalls - numForced;
  const randomNums = [];

  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n) && !shuffledForced.includes(n)
  );
  while (randomNums.length < numRandom && availableNumbers.length > 0) {
    const randIndex = Math.floor(Math.random() * availableNumbers.length);
    randomNums.push(availableNumbers.splice(randIndex, 1)[0]);
  }

  const sequence = new Array(totalCalls).fill(null);
  const forcedPositions = [];
  while (forcedPositions.length < numForced - 1) {
    const pos = Math.floor(Math.random() * (totalCalls - 1));
    if (!forcedPositions.includes(pos)) forcedPositions.push(pos);
  }
  forcedPositions.push(totalCalls - 1);

  forcedPositions.forEach((pos, idx) => {
    sequence[pos] = Number(shuffledForced[idx]);
  });

  let randomIndex = 0;
  for (let i = 0; i < totalCalls; i++) {
    if (sequence[i] === null && randomIndex < randomNums.length) {
      sequence[i] = randomNums[randomIndex++];
    }
  }

  return sequence
    .filter((num) => num !== null)
    .filter((num, index, self) => self.indexOf(num) === index);
};

/**
 * Check bingo for a specific card in a game
 */
export const checkBingoForGame = (game, cardId) => {
  const numericCardId = Number(cardId);
  const card = game.selectedCards.find((c) => c.id === numericCardId);
  if (!card) return { hasBingo: false, winnerCards: [], winnerPattern: null };

  const { isBingo } = checkCardBingo(
    card.numbers,
    game.calledNumbers,
    game.pattern
  );
  return {
    hasBingo: isBingo,
    winnerCards: isBingo ? [numericCardId] : [],
    winnerPattern: isBingo ? game.pattern : null,
  };
};

/**
 * Logs a jackpot update.
 */
export const logJackpotUpdate = async (amount, reason, gameId = null) => {
  await JackpotLog.create({
    amount,
    reason,
    gameId,
    timestamp: new Date(),
  });
};

/**
 * Creates a new game record with provided configuration.
 */
export const createGameRecord = async ({
  gameNumber,
  cashierId,
  betAmount,
  houseFeePercentage,
  houseFee,
  selectedCards,
  pattern,
  prizePool,
  jackpotContribution,
  jackpotEnabled = true,
  moderatorWinnerCardId = null,
  selectedWinnerRowIndices = [],
  forcedPattern = null,
  forcedCallSequence = [],
  winnerCardNumbers = null,
  selectedWinnerNumbers = [],
  targetWinCall = null,
  forcedCallIndex = 0,
}) => {
  // Validate inputs
  if (
    !selectedCards ||
    !Array.isArray(selectedCards) ||
    selectedCards.length === 0
  ) {
    throw new Error("Game cards must be a non-empty array");
  }

  const validPatterns = [
    "four_corners_center",
    "cross",
    "main_diagonal",
    "other_diagonal",
    "horizontal_line",
    "vertical_line",
    "all",
  ];
  if (!validPatterns.includes(pattern)) {
    throw new Error("Invalid pattern type");
  }

  if (!mongoose.isValidObjectId(cashierId)) {
    throw new Error("Invalid cashier ID");
  }

  if (!Number.isFinite(houseFee) || houseFee < 0) {
    throw new Error(`Invalid houseFee: ${houseFee}`);
  }

  if (!Number.isFinite(prizePool) || prizePool < 0) {
    throw new Error(`Invalid prizePool: ${prizePool}`);
  }

  if (!Number.isFinite(jackpotContribution) || jackpotContribution < 0) {
    throw new Error(`Invalid jackpotContribution: ${jackpotContribution}`);
  }

  // Log financials for debugging
  console.log("[createGameRecord] Creating game with:", {
    gameNumber,
    betAmount,
    houseFeePercentage,
    houseFee,
    selectedCardsLength: selectedCards.length,
    prizePool,
    jackpotContribution,
    jackpotEnabled,
    selectedWinnerNumbers,
  });

  // Create the game
  const game = new Game({
    gameNumber,
    cashierId,
    betAmount,
    houseFeePercentage,
    houseFee: parseFloat(houseFee.toFixed(2)),
    selectedCards,
    pattern,
    prizePool: parseFloat(prizePool.toFixed(2)),
    jackpotContribution: parseFloat(jackpotContribution.toFixed(2)),
    jackpotEnabled,
    status: "pending",
    calledNumbers: [],
    calledNumbersLog: [],
    moderatorWinnerCardId,
    selectedWinnerRowIndices,
    forcedPattern,
    forcedCallSequence,
    forcedCallIndex,
    targetWinCall,
    winnerCardNumbers,
    selectedWinnerNumbers,
    winner: null,
  });

  await game.save();

  // Log stored game data
  console.log("[createGameRecord] Game created:", {
    gameNumber: game.gameNumber,
    houseFee: game.houseFee,
    prizePool: game.prizePool,
    jackpotContribution: game.jackpotContribution,
  });

  // Create game log
  await GameLog.create({
    gameId: game._id,
    action: "createGameRecord",
    status: "success",
    details: {
      gameNumber: game.gameNumber,
      pattern,
      selectedCardIds: selectedCards.map((card) => card.id),
      jackpotEnabled: game.jackpotEnabled,
    },
  });

  // Delete future winning counter if moderatorWinnerCardId is provided
  if (moderatorWinnerCardId) {
    await Counter.deleteOne({
      _id: `futureWinning_${gameNumber}_${cashierId}`,
    });
  }

  return game;
};

/**
 * Validates user authorization and returns cashierId
 */
export const getCashierIdFromUser = (req, res, next) => {
  const user = req.user;

  if (!user || !user.id) {
    return res.status(401).json({ message: "Unauthorized. User ID missing." });
  }

  let cashierId;
  if (user.role === "moderator") {
    cashierId = user.managedCashier;
    if (!cashierId) {
      return res.status(403).json({
        message: "No managed cashier assigned to this moderator",
      });
    }
  } else if (user.role === "cashier") {
    cashierId = user.id;
  } else {
    return res.status(403).json({ message: "Unauthorized role" });
  }

  req.cashierId = cashierId;
  next();
};

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const computeForcedSequence = (
  requiredNumbers,
  minCalls = 10,
  maxCalls = 15
) => {
  if (!requiredNumbers || requiredNumbers.length === 0) return [];
  const K = requiredNumbers.length;
  // Randomly choose number of calls between minCalls and maxCalls
  let winCall =
    Math.floor(Math.random() * (maxCalls - minCalls + 1)) + minCalls;
  if (winCall < K) winCall = K; // Ensure at least K calls
  const shuffledReq = shuffle(requiredNumbers);
  const lastReq = shuffledReq.pop(); // Last required number
  const firstReq = shuffledReq; // K-1 required numbers
  const numFillers = winCall - K; // Number of filler numbers
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1);
  const possibleFillers = allNums.filter((n) => !requiredNumbers.includes(n));
  const fillers = shuffle(possibleFillers).slice(0, numFillers);
  const preItems = [...firstReq, ...fillers];
  shuffle(preItems);
  return [...preItems, lastReq]; // Last call ensures win
};

/**
 * Generate a quick win sequence for Bingo
 * @param {number[]} requiredNumbers - Numbers that must appear for the winner card to win
 * @param {number} totalCalls - Total calls to finish the game (e.g., 10)
 * @param {number} maxRandomNumbers - Maximum random numbers to interleave
 * @returns {number[]} Forced sequence with random numbers
 */
export function generateQuickWinSequence(requiredNumbers, minCalls, maxCalls) {
  if (!requiredNumbers || requiredNumbers.length === 0) {
    console.warn("[generateQuickWinSequence] No required numbers provided");
    return [];
  }

  const K = requiredNumbers.length;
  // Randomly choose total calls (ensure >= K)
  const totalCalls = Math.max(
    K,
    Math.floor(Math.random() * (maxCalls - minCalls + 1)) + minCalls
  );

  console.log(
    `[generateQuickWinSequence] Generating sequence: ${K} required nums, totalCalls=${totalCalls} (min=${minCalls}, max=${maxCalls})`
  );

  // Choose completing number (random from required)
  const completingIdx = Math.floor(Math.random() * requiredNumbers.length);
  const completingNum = requiredNumbers[completingIdx];
  const otherRequired = requiredNumbers.filter(
    (_, idx) => idx !== completingIdx
  );

  // Fillers: totalCalls - K (non-required numbers)
  const numFillers = totalCalls - K;
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1);
  const possibleFillers = allNums.filter((n) => !requiredNumbers.includes(n));
  const shuffledFillers = shuffle(possibleFillers).slice(0, numFillers); // Use existing shuffle util

  // Pre-sequence: shuffle otherRequired + fillers
  const preItems = [...otherRequired, ...shuffledFillers];
  shuffle(preItems);

  const sequence = [...preItems, completingNum]; // Last call completes win

  console.log(
    `[generateQuickWinSequence] Sequence ready: ${sequence.length} calls, completing num=${completingNum}, fillers=${numFillers}`
  );
  console.log(
    `[generateQuickWinSequence] Full sequence preview: ${sequence.slice(0, 5)}${
      sequence.length > 5 ? "..." : ""
    } -> ${completingNum}`
  );

  return sequence;
}

// utils/gameUtils.js - Add these functions

export const logFutureWinnerUsage = async (
  futureWinnerId,
  gameId,
  success = true
) => {
  try {
    await GameLog.create({
      gameId,
      action: "useFutureWinner",
      status: success ? "success" : "failed",
      details: {
        futureWinnerId,
        gameId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error logging future winner usage:", error);
  }
};

export const logNumberCall = async (
  gameId,
  calledNumber,
  isForced = false,
  callIndex = null
) => {
  try {
    await GameLog.create({
      gameId,
      action: "callNumber",
      status: "success",
      details: {
        calledNumber,
        isForced,
        callIndex,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error logging number call:", error);
  }
};
