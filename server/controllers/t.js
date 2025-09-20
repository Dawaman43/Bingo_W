// Helper function to get specific line information for the last called number
const getSpecificLineInfo = (cardNumbers, pattern, lastCalledNumber) => {
  if (!lastCalledNumber) return null;

  const targetStr = String(lastCalledNumber);
  const flatNumbers = cardNumbers.flat();
  const targetIndex = flatNumbers.findIndex(num => String(num) === targetStr);
  
  if (targetIndex === -1) return null;
  
  const row = Math.floor(targetIndex / 5);
  const col = targetIndex % 5;

  console.log(`[getSpecificLineInfo] lastCalledNumber ${lastCalledNumber} found at row ${row}, col ${col}`);

  switch (pattern) {
    case "horizontal_line":
      return { lineType: 'row', lineIndex: row };
    
    case "vertical_line":
      return { lineType: 'column', lineIndex: col };
    
    case "main_diagonal":
      // Check if this number is on the main diagonal (row === col)
      if (row === col) {
        return { lineType: 'main_diagonal' };
      }
      return null;
    
    case "other_diagonal":
      // Check if this number is on the other diagonal (row + col === 4)
      if (row + col === 4) {
        return { lineType: 'other_diagonal' };
      }
      return null;
    
    case "four_corners_center":
      // Check if this is one of the 5 positions
      const positions = [
        { row: 0, col: 0 }, // top-left
        { row: 0, col: 4 }, // top-right
        { row: 4, col: 0 }, // bottom-left
        { row: 4, col: 4 }, // bottom-right
        { row: 2, col: 2 }  // center
      ];
      const position = positions.find(p => p.row === row && p.col === col);
      if (position) {
        return { lineType: 'four_corners_center' };
      }
      return null;
    
    case "inner_corners":
      // Check if this is one of the 4 inner corners
      const innerPositions = [
        { row: 1, col: 1 }, // I2
        { row: 1, col: 3 }, // O2
        { row: 3, col: 1 }, // I4
        { row: 3, col: 3 }  // O4
      ];
      const innerPosition = innerPositions.find(p => p.row === row && p.col === col);
      if (innerPosition) {
        return { lineType: 'inner_corners' };
      }
      return null;
    
    default:
      return null;
  }
};

// Helper function to check if a specific line was complete with given called numbers
const checkSpecificLineCompletion = (cardNumbers, calledNumbers, pattern, lineInfo) => {
  const markedGrid = getMarkedGrid(cardNumbers, calledNumbers);
  
  console.log(`[checkSpecificLineCompletion] Checking ${lineInfo.lineType} for pattern ${pattern}`);

  const isLineComplete = (markedGrid, lineType) => {
    switch (lineType) {
      case 'row':
        const rowIndex = lineInfo.lineIndex;
        const rowComplete = markedGrid[rowIndex].every(cell => cell === true || cell === null);
        console.log(`[checkSpecificLineCompletion] Row ${rowIndex}: ${markedGrid[rowIndex].join(', ')} → complete: ${rowComplete}`);
        return rowComplete;
      
      case 'column':
        const colIndex = lineInfo.lineIndex;
        const colComplete = [0, 1, 2, 3, 4].every(rowIndex => 
          markedGrid[rowIndex][colIndex] === true || markedGrid[rowIndex][colIndex] === null
        );
        console.log(`[checkSpecificLineCompletion] Col ${colIndex}: [${[0,1,2,3,4].map(r => markedGrid[r][colIndex]).join(', ')}] → complete: ${colComplete}`);
        return colComplete;
      
      case 'main_diagonal':
        const mainDiagComplete = [0, 1, 2, 3, 4].every(i => 
          markedGrid[i][i] === true || markedGrid[i][i] === null
        );
        console.log(`[checkSpecificLineCompletion] Main diagonal: [${[0,1,2,3,4].map(i => markedGrid[i][i]).join(', ')}] → complete: ${mainDiagComplete}`);
        return mainDiagComplete;
      
      case 'other_diagonal':
        const otherDiagComplete = [0, 1, 2, 3, 4].every(i => 
          markedGrid[i][4 - i] === true || markedGrid[i][4 - i] === null
        );
        console.log(`[checkSpecificLineCompletion] Other diagonal: [${[0,1,2,3,4].map(i => markedGrid[i][4-i]).join(', ')}] → complete: ${otherDiagComplete}`);
        return otherDiagComplete;
      
      case 'four_corners_center':
        const cornersComplete = [
          markedGrid[0][0],
          markedGrid[0][4],
          markedGrid[4][0],
          markedGrid[4][4],
          markedGrid[2][2]
        ].every(cell => cell === true || cell === null);
        console.log(`[checkSpecificLineCompletion] Four corners: [${[markedGrid[0][0],markedGrid[0][4],markedGrid[4][0],markedGrid[4][4],markedGrid[2][2]].join(', ')}] → complete: ${cornersComplete}`);
        return cornersComplete;
      
      case 'inner_corners':
        const innerComplete = [
          markedGrid[1][1],
          markedGrid[1][3],
          markedGrid[3][1],
          markedGrid[3][3]
        ].every(cell => cell === true);
        console.log(`[checkSpecificLineCompletion] Inner corners: [${[markedGrid[1][1],markedGrid[1][3],markedGrid[3][1],markedGrid[3][3]].join(', ')}] → complete: ${innerComplete}`);
        return innerComplete;
      
      default:
        console.log(`[checkSpecificLineCompletion] Unknown line type: ${lineType}`);
        return false;
    }
  };

  return isLineComplete(markedGrid, lineInfo.lineType);
};

export const checkBingo = async (req, res, next) => {
  try {
    const { cardId, identifier, preferredPattern } = req.body;
    const gameId = req.params.id;

    const game = await Game.findById(gameId);
    if (!game) {
      console.warn(`[checkBingo] ❌ Game not found: ${gameId}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: "Game not found",
          timestamp: new Date(),
        },
      });
      return res.status(404).json({ message: "Game not found" });
    }

    const numericCardId = Number(cardId);
    const card = game.selectedCards.find((c) => c.id === numericCardId);
    if (!card) {
      console.warn(`[checkBingo] ❌ Card not in game: ${numericCardId}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: `Card ${numericCardId}```javascript
// 🔑 HELPER FUNCTIONS - Add these at the top of your bingoController.js file or in a separate utils file and import them

// Get specific line information for the last called number
const getSpecificLineInfo = (cardNumbers, pattern, lastCalledNumber) => {
  if (!lastCalledNumber) return null;

  const targetStr = String(lastCalledNumber);
  const flatNumbers = cardNumbers.flat();
  const targetIndex = flatNumbers.findIndex(num => String(num) === targetStr);
  
  if (targetIndex === -1) return null;
  
  const row = Math.floor(targetIndex / 5);
  const col = targetIndex % 5;

  console.log(`[getSpecificLineInfo] lastCalledNumber ${lastCalledNumber} found at row ${row}, col ${col}`);

  switch (pattern) {
    case "horizontal_line":
      return { lineType: 'row', lineIndex: row };
    
    case "vertical_line":
      return { lineType: 'column', lineIndex: col };
    
    case "main_diagonal":
      if (row === col) {
        return { lineType: 'main_diagonal', lineIndex: row };
      }
      return null;
    
    case "other_diagonal":
      if (row + col === 4) {
        return { lineType: 'other_diagonal', lineIndex: row };
      }
      return null;
    
    case "four_corners_center":
      const positions = [
        { row: 0, col: 0 },
        { row: 0, col: 4 },
        { row: 4, col: 0 },
        { row: 4, col: 4 },
        { row: 2, col: 2 }
      ];
      const position = positions.find(p => p.row === row && p.col === col);
      if (position) {
        return { lineType: 'four_corners_center', positions };
      }
      return null;
    
    case "inner_corners":
      const innerPositions = [
        { row: 1, col: 1 },
        { row: 1, col: 3 },
        { row: 3, col: 1 },
        { row: 3, col: 3 }
      ];
      const innerPosition = innerPositions.find(p => p.row === row && p.col === col);
      if (innerPosition) {
        return { lineType: 'inner_corners', positions: innerPositions };
      }
      return null;
    
    default:
      return null;
  }
};

// Check if a specific line was complete with given called numbers
const checkSpecificLineCompletion = (cardNumbers, calledNumbers, pattern, lineInfo) => {
  const markedGrid = getMarkedGrid(cardNumbers, calledNumbers);
  
  console.log(`[checkSpecificLineCompletion] Checking ${lineInfo.lineType} for pattern ${pattern}`);

  const isLineComplete = (markedGrid, lineType) => {
    switch (lineType) {
      case 'row':
        const rowComplete = markedGrid[lineInfo.lineIndex].every(cell => cell === true || cell === null);
        console.log(`[checkSpecificLineCompletion] Row ${lineInfo.lineIndex}: ${markedGrid[lineInfo.lineIndex].join(', ')} → complete: ${rowComplete}`);
        return rowComplete;
      
      case 'column':
        const colComplete = [0, 1, 2, 3, 4].every(rowIndex => 
          markedGrid[rowIndex][lineInfo.lineIndex] === true || markedGrid[rowIndex][lineInfo.lineIndex] === null
        );
        console.log(`[checkSpecificLineCompletion] Col ${lineInfo.lineIndex}: [${[0,1,2,3,4].map(r => markedGrid[r][lineInfo.lineIndex]).join(', ')}] → complete: ${colComplete}`);
        return colComplete;
      
      case 'main_diagonal':
        const mainDiagComplete = [0, 1, 2, 3, 4].every(i => 
          markedGrid[i][i] === true || markedGrid[i][i] === null
        );
        console.log(`[checkSpecificLineCompletion] Main diagonal complete: ${mainDiagComplete}`);
        return mainDiagComplete;
      
      case 'other_diagonal':
        const otherDiagComplete = [0, 1, 2, 3, 4].every(i => 
          markedGrid[i][4 - i] === true || markedGrid[i][4 - i] === null
        );
        console.log(`[checkSpecificLineCompletion] Other diagonal complete: ${otherDiagComplete}`);
        return otherDiagComplete;
      
      case 'four_corners_center':
        const cornersComplete = [
          markedGrid[0][0],
          markedGrid[0][4],
          markedGrid[4][0],
          markedGrid[4][4],
          markedGrid[2][2]
        ].every(cell => cell === true || cell === null);
        console.log(`[checkSpecificLineCompletion] Four corners complete: ${cornersComplete}`);
        return cornersComplete;
      
      case 'inner_corners':
        const innerComplete = [
          markedGrid[1][1],
          markedGrid[1][3],
          markedGrid[3][1],
          markedGrid[3][3]
        ].every(cell => cell === true);
        console.log(`[checkSpecificLineCompletion] Inner corners complete: ${innerComplete}`);
        return innerComplete;
      
      default:
        return false;
    }
  };

  return isLineComplete(markedGrid, lineInfo.lineType);
};

// 🔑 Full Updated checkBingo Function
