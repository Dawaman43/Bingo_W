// controllers/soundController.js
import Sound from "../models/Sound.js";

export const getSound = async (req, res, next) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath)
      return res.status(400).json({ message: "Missing path query" });

    const normalizedPath = decodeURIComponent(rawPath).replace(/\\/g, "/");

    const sound = await Sound.findOne({ path: normalizedPath });
    if (!sound)
      return res
        .status(404)
        .json({ message: `Sound not found: ${normalizedPath}` });

    res.setHeader("Content-Type", sound.contentType);
    res.setHeader("Content-Length", sound.data.length);
    res.setHeader("Accept-Ranges", "bytes");

    res.send(sound.data);
  } catch (err) {
    console.error(err);
    next(err);
  }
};
