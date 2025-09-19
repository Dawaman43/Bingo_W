/**
 * Returns indices for a given bingo pattern on a 5x5 card, excluding free space.
 * @param {number[][]} numbers - 5x5 array of card numbers (center may be "FREE").
 * @param {string} pattern - Pattern name (e.g., 'horizontal_line', 'cross').
 * @param {number[]} excludeIndices - Indices to exclude (optional).
 * @param {boolean} isWinner - If true, select specific indices for winner card.
 * @returns {{ selectedIndices: number[], selectedNumbers: number[] }} - Object with selected indices and corresponding numbers.
 */
export function getNumbersForPattern(
  numbers,
  pattern,
  excludeIndices = [],
  isWinner = false
) {
  // Validate input
  if (
    !Array.isArray(numbers) ||
    numbers.length !== 5 ||
    numbers.some((row) => !Array.isArray(row) || row.length !== 5)
  ) {
    throw new Error("Invalid card numbers: must be a 5x5 array");
  }
  if (!pattern) {
    throw new Error("Pattern must be specified");
  }

  // Define pattern indices (0-24 for 5x5 grid, row-major order)
  const patterns = {
    four_corners_center: [0, 4, 20, 24, 12], // Top-left, top-right, bottom-left, bottom-right, center
    cross: [2, 7, 12, 17, 22, 10, 11, 13, 14], // Middle column and middle row
    main_diagonal: [0, 6, 12, 18, 24], // Top-left to bottom-right
    other_diagonal: [4, 8, 12, 16, 20], // Top-right to bottom-left
    horizontal_line: [0, 1, 2, 3, 4], // First row (configurable if isWinner is false)
    vertical_line: [0, 5, 10, 15, 20], // First column (configurable if isWinner is false)
  };

  let selectedIndices = [];

  if (pattern === "all") {
    // For 'all' pattern, select all non-free space indices
    selectedIndices = Array.from({ length: 25 }, (_, i) => i).filter(
      (i) => i !== 12
    ); // Exclude center (free space)
  } else if (patterns[pattern]) {
    selectedIndices = patterns[pattern];
    // For non-winner cards, randomly select a row or column for flexible patterns
    if (!isWinner && pattern === "horizontal_line") {
      const row = Math.floor(Math.random() * 5);
      selectedIndices = [
        row * 5,
        row * 5 + 1,
        row * 5 + 2,
        row * 5 + 3,
        row * 5 + 4,
      ];
    } else if (!isWinner && pattern === "vertical_line") {
      const col = Math.floor(Math.random() * 5);
      selectedIndices = [col, col + 5, col + 10, col + 15, col + 20];
    }
  } else {
    throw new Error(`Invalid pattern: ${pattern}`);
  }

  // Filter out excluded indices and free space (index 12)
  selectedIndices = selectedIndices.filter(
    (idx) => !excludeIndices.includes(idx) && idx !== 12
  );

  // Map indices to actual numbers, excluding "FREE"
  const flatNumbers = numbers.flat();
  const selectedNumbers = selectedIndices
    .map((idx) => flatNumbers[idx])
    .filter((num) => typeof num === "number" && num >= 1 && num <= 75);

  return { selectedIndices, selectedNumbers };
}

/**
 * Generates a forced call sequence of 10–15 numbers, starting with required numbers.
 * @param {number[]} requiredNumbers - Numbers that must appear first (1–75).
 * @param {number} minLength - Minimum sequence length (default: 10).
 * @param {number} maxLength - Maximum sequence length (default: 15).
 * @returns {number[]} - Sequence of numbers.
 */
export function computeForcedSequence(
  requiredNumbers,
  minLength = 10,
  maxLength = 15
) {
  // Validate input
  if (!Array.isArray(requiredNumbers)) {
    throw new Error("Required numbers must be an array");
  }
  if (minLength > maxLength) {
    throw new Error("minLength cannot be greater than maxLength");
  }
  if (
    requiredNumbers.some(
      (num) => typeof num !== "number" || num < 1 || num > 75
    )
  ) {
    throw new Error("Required numbers must be valid bingo numbers (1–75)");
  }

  // Initialize sequence with required numbers
  const sequence = [...requiredNumbers];

  // Generate remaining numbers
  const remainingCount =
    Math.floor(Math.random() * (maxLength - minLength + 1)) +
    minLength -
    requiredNumbers.length;
  if (remainingCount <= 0) {
    return sequence; // Return early if required numbers meet or exceed length
  }

  // Create pool of available numbers (1–75, excluding required numbers)
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !requiredNumbers.includes(n)
  );

  // Shuffle available numbers and select the needed amount
  for (let i = availableNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableNumbers[i], availableNumbers[j]] = [
      availableNumbers[j],
      availableNumbers[i],
    ];
  }

  // Add random numbers to sequence
  sequence.push(...availableNumbers.slice(0, remainingCount));

  return sequence;
}
