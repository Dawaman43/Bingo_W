import { body, param } from "express-validator";

export const validate = [
  // Game Routes
  body("betAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Bet amount must be a positive number"),
  body("houseFeePercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("House percentage must be between 0 and 100"),
  body("pattern")
    .optional()
    .isIn([
      "four_corners_center",
      "cross",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
      "all",
    ])
    .withMessage("Invalid pattern"),
  body("selectedCards")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one card must be selected"),
  body("selectedCards.*.id")
    .optional()
    .isInt()
    .withMessage("Card ID must be an integer"),
  body("selectedCards.*.numbers")
    .optional()
    .isArray({ min: 25, max: 25 })
    .withMessage("Each card must have exactly 25 numbers"),
  body("number")
    .optional()
    .isInt({ min: 1, max: 75 })
    .withMessage("Number must be between 1 and 75"),
  body("cardId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Card ID must be a positive integer"),
  body("gameId")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) return true; // Allow null
      if (typeof value === "number") return true; // Allow numeric gameNumber
      if (!mongoose.isValidObjectId(value)) {
        throw new Error("Game ID must be a valid MongoDB ID, number, or null");
      }
      return true;
    })
    .withMessage("Game ID must be a valid MongoDB ID, number, or null"),

  body("drawAmount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Draw amount must be a positive number"),
  body("message")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Message must be a string with max 200 characters"),
  param("id")
    .optional()
    .isMongoId()
    .withMessage("ID must be a valid MongoDB ID"),
  param("gameId")
    .optional()
    .isMongoId()
    .withMessage("Game ID must be a valid MongoDB ID"),

  // Auth Routes
  body("name")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Name is required"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("password")
    .optional()
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["cashier", "moderator"])
    .withMessage("Role must be cashier or moderator"),

  // Admin Routes
  body("name")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Name is required"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("password")
    .optional()
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["cashier", "moderator"])
    .withMessage("Role must be cashier or moderator"),
];
