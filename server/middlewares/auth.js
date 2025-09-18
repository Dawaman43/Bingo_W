import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    console.log(
      "[verifyToken] Received Authorization header:",
      authHeader ? authHeader.substring(0, 50) + "..." : "Missing"
    ); // Log partial header for security

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[verifyToken] No token provided in Authorization header");
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    console.log(
      "[verifyToken] Verifying token (partial):",
      token.substring(0, 20) + "..."
    );

    if (!process.env.JWT_SECRET_KEY) {
      console.error("[verifyToken] JWT_SECRET_KEY is not set in environment");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    console.log(
      "[verifyToken] Token decoded successfully. Payload (partial):",
      { id: decoded.id, role: decoded.role }
    );

    req.user = decoded; // This sets { id, name, email, role }
    next();
  } catch (error) {
    console.error("[verifyToken] Token verification failed:", {
      message: error.message,
      name: error.name,
      tokenPartial: authHeader
        ? authHeader.split(" ")[1]?.substring(0, 20) + "..."
        : "N/A",
    });
    return res.status(403).json({
      message: "Invalid or expired token",
      error: error.message, // Expose for debugging (remove in production)
      errorCode: "INVALID_TOKEN",
    });
  }
};

export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ message: "Unauthorized. No user data found." });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
};
