/**
 * Returns indices for a given bingo pattern on a 5x5 card, excluding free space.
 * @param {number[][]} numbers - 5x5 array of card numbers (center may be "FREE").
 * @param {string} pattern - Pattern name (e.g., 'horizontal_line', 'cross', 'full_card').
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
  console.log(
    "[getNumbersForPattern] Processing pattern:",
    pattern,
    "with numbers:",
    numbers
  );

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
    all: Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12), // All non-free space indices
    full_card: Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12), // Alias for "all"
  };

  let selectedIndices = [];

  if (patterns[pattern]) {
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

  console.log("[getNumbersForPattern] Returning:", {
    selectedIndices,
    selectedNumbers,
  });
  return { selectedIndices, selectedNumbers };
}

/**
 * Generates a forced call sequence of 10–15 numbers, starting with required numbers.
 * This function ensures the required numbers appear early in the sequence for quick wins.
 * @param {number[]} requiredNumbers - Numbers that must appear first (1–75).
 * @param {number} targetLength - Target sequence length (default: 12).
 * @param {number} minLength - Minimum sequence length (default: 10).
 * @param {number} maxLength - Maximum sequence length (default: 15).
 * @returns {number[]} - Sequence of numbers ensuring quick win.
 */
export function generateQuickWinSequence(
  requiredNumbers,
  targetLength = 12,
  minLength = 10,
  maxLength = 15
) {
  console.log(
    "[generateQuickWinSequence] Generating sequence for required numbers:",
    requiredNumbers,
    "Target length:",
    targetLength
  );

  // Validate input
  if (!Array.isArray(requiredNumbers)) {
    throw new Error("Required numbers must be an array");
  }
  if (minLength > maxLength) {
    throw new Error("minLength cannot be greater than maxLength");
  }
  if (targetLength < minLength || targetLength > maxLength) {
    throw new Error(
      `targetLength must be between ${minLength} and ${maxLength}`
    );
  }
  if (
    requiredNumbers.some(
      (num) => typeof num !== "number" || num < 1 || num > 75
    )
  ) {
    throw new Error("Required numbers must be valid bingo numbers (1–75)");
  }

  // Remove duplicates and validate unique numbers
  const uniqueRequired = [...new Set(requiredNumbers)].filter(
    (num) => num >= 1 && num <= 75
  );

  if (uniqueRequired.length !== requiredNumbers.length) {
    console.warn(
      "[generateQuickWinSequence] Removed duplicates from required numbers. Original:",
      requiredNumbers.length,
      "Unique:",
      uniqueRequired.length
    );
  }

  // If required numbers exceed target length, trim them
  const requiredToUse = uniqueRequired.slice(0, targetLength);
  const sequenceLength = Math.max(
    targetLength,
    Math.min(maxLength, Math.max(minLength, requiredToUse.length))
  );

  console.log(
    "[generateQuickWinSequence] Using",
    requiredToUse.length,
    "required numbers for sequence length:",
    sequenceLength
  );

  // Strategy 1: Distribute required numbers strategically in first half of sequence
  const sequence = [];
  const requiredCount = requiredToUse.length;
  const totalLength = sequenceLength;

  // Place required numbers in strategic positions (first 60% of sequence)
  const requiredPositions = [];
  for (let i = 0; i < requiredCount; i++) {
    // Spread required numbers across first 60% of sequence
    const position = Math.floor((i / requiredCount) * 0.6 * totalLength);
    requiredPositions.push(
      Math.min(position + i * 2, Math.floor(0.6 * totalLength))
    ); // Ensure unique positions
  }

  // Sort positions to maintain logical order
  requiredPositions.sort((a, b) => a - b);

  console.log(
    "[generateQuickWinSequence] Required positions:",
    requiredPositions
  );

  // Build sequence with required numbers in calculated positions
  for (let i = 0; i < totalLength; i++) {
    const positionIndex = requiredPositions.indexOf(i);
    if (positionIndex !== -1 && positionIndex < requiredToUse.length) {
      sequence.push(requiredToUse[positionIndex]);
    } else {
      // Fill with random numbers (excluding already used numbers)
      sequence.push(null); // Placeholder for random numbers
    }
  }

  // Generate pool of available numbers (1–75, excluding required numbers)
  const usedNumbers = [...requiredToUse];
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !usedNumbers.includes(n)
  );

  // Shuffle available numbers
  for (let i = availableNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableNumbers[i], availableNumbers[j]] = [
      availableNumbers[j],
      availableNumbers[i],
    ];
  }

  // Fill placeholders with random numbers
  let availableIndex = 0;
  const finalSequence = sequence.map((num) => {
    if (num !== null) {
      return num;
    }
    if (availableIndex < availableNumbers.length) {
      return availableNumbers[availableIndex++];
    }
    // Fallback: generate another random number
    const fallback = Math.floor(Math.random() * 75) + 1;
    return usedNumbers.includes(fallback) ? availableNumbers[0] : fallback;
  });

  // Ensure all required numbers are included (safety check)
  const missingRequired = requiredToUse.filter(
    (reqNum) => !finalSequence.includes(reqNum)
  );
  if (missingRequired.length > 0) {
    console.warn(
      "[generateQuickWinSequence] Missing required numbers, adding them:",
      missingRequired
    );
    // Replace last few random numbers with missing required numbers
    for (
      let i = 0;
      i < missingRequired.length && finalSequence.length > requiredToUse.length;
      i++
    ) {
      finalSequence[finalSequence.length - 1 - i] = missingRequired[i];
    }
  }

  console.log("[generateQuickWinSequence] Final sequence:", finalSequence);
  console.log(
    "[generateQuickWinSequence] Required numbers coverage:",
    requiredToUse.every((req) => finalSequence.includes(req))
      ? "✅ All covered"
      : "❌ Missing some"
  );

  return finalSequence;
}

/**
 * Legacy function - use generateQuickWinSequence instead
 * Generates a forced call sequence of 10–15 numbers, starting with required numbers.
 * @param {number[]} requiredNumbers - Numbers that must appear first (1–75).
 * @param {number} minLength - Minimum sequence length (default: 10).
 * @param {number} maxLength - Maximum sequence length (default: 15).
 * @returns {number[]} - Sequence of numbers.
 * @deprecated Use generateQuickWinSequence instead
 */
export function computeForcedSequence(
  requiredNumbers,
  minLength = 10,
  maxLength = 15
) {
  console.warn(
    "[computeForcedSequence] This function is deprecated. Use generateQuickWinSequence instead."
  );

  // Call the new function with target length in the middle of the range
  const targetLength = Math.floor((minLength + maxLength) / 2);
  return generateQuickWinSequence(
    requiredNumbers,
    targetLength,
    minLength,
    maxLength
  );
}

/**
 * Generates a simple random bingo sequence excluding specified numbers.
 * @param {number[]} excludeNumbers - Numbers to exclude from the sequence (1–75).
 * @param {number} sequenceLength - Length of sequence to generate (default: 75).
 * @returns {number[]} - Random sequence of bingo numbers.
 */
export function generateRandomBingoSequence(
  excludeNumbers = [],
  sequenceLength = 75
) {
  // Create pool of available numbers
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !excludeNumbers.includes(n)
  );

  if (availableNumbers.length < sequenceLength) {
    throw new Error(
      `Cannot generate sequence of length ${sequenceLength} with only ${availableNumbers.length} available numbers`
    );
  }

  // Shuffle and slice
  const shuffled = [...availableNumbers].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(sequenceLength, availableNumbers.length));
}

/**
 * Validates a bingo card pattern and returns completion status.
 * @param {number[][]} cardNumbers - 5x5 bingo card numbers.
 * @param {number[]} calledNumbers - Numbers that have been called.
 * @param {string} pattern - Pattern to check (e.g., 'horizontal_line').
 * @returns {Object} - Validation result with completion status.
 */
export function validatePatternCompletion(cardNumbers, calledNumbers, pattern) {
  const { selectedNumbers } = getNumbersForPattern(
    cardNumbers,
    pattern,
    [],
    false
  );
  const completedNumbers = selectedNumbers.filter((num) =>
    calledNumbers.includes(num)
  );

  return {
    pattern,
    requiredCount: selectedNumbers.length,
    completedCount: completedNumbers.length,
    completionPercentage: (
      (completedNumbers.length / selectedNumbers.length) *
      100
    ).toFixed(1),
    isComplete: completedNumbers.length === selectedNumbers.length,
    completedNumbers,
    remainingNumbers: selectedNumbers.filter(
      (num) => !calledNumbers.includes(num)
    ),
  };
}

/**
 * Analyzes multiple patterns for pattern completion status.
 * @param {number[][]} cardNumbers - 5x5 bingo card numbers.
 * @param {number[]} calledNumbers - Numbers that have been called.
 * @returns {Object[]} - Array of pattern validation results.
 */
export function analyzeAllPatterns(cardNumbers, calledNumbers) {
  const validPatterns = [
    "four_corners_center",
    "cross",
    "main_diagonal",
    "other_diagonal",
    "horizontal_line",
    "vertical_line",
  ];

  return validPatterns
    .map((pattern) =>
      validatePatternCompletion(cardNumbers, calledNumbers, pattern)
    )
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
}
