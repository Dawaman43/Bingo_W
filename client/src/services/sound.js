import API from "./axios";

class SoundService {
  constructor() {
    this.audioCache = {};
    this.lastWinnerAt = 0; // timestamp to suppress non-winner right after winner
  }

  async preloadAudio(key, url) {
    try {
      const response = await API.get(url, {
        responseType: "arraybuffer", // important for audio data
      });

      const blob = new Blob([response.data], { type: "audio/ogg" }); // or 'audio/opus' if supported
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.preload = "auto";

      return new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log(`Successfully loaded audio: ${key}`);
          resolve(audio);
        };
        audio.onerror = (err) => {
          console.error(`Failed to load audio: ${key}`, err);
          reject(new Error(`Failed to load ${url}`));
        };
        audio.load();
      });
    } catch (error) {
      console.error(`Axios error loading ${key} from ${url}:`, error);
      throw error;
    }
  }

  async preloadSounds(language) {
    const numberSounds = Array.from({ length: 75 }, (_, i) => {
      const num = i + 1;
      return [
        `number_${num}`,
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/${num}.opus`,
      ];
    });

    const staticSounds = [
      [
        "game_start",
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/started${
          language === "am" ? "ahm" : "oromic"
        }.opus`,
      ],
      [
        "game_pause",
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/paused${
          language === "am" ? "amh" : "oromic"
        }.opus`,
      ],
      [
        "game_finish",
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/finish${
          language === "am" ? "amh" : "oromic"
        }.opus`,
      ],
      [
        "winner",
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/win${
          language === "am" ? "amh" : "oromic"
        }.opus`,
      ],
      [
        "you_didnt_win",
        `/sounds?path=${language === "am" ? "amharic" : "voices"}/locked${
          language === "am" ? "amh" : "oromic"
        }.opus`,
      ],
      ["shuffle", `/sounds?path=effects/shuffle.opus`],
      ["jackpot-running", `/sounds?path=effects/jackpot-running.opus`],
      ["jackpot-congrats", `/sounds?path=effects/jackpot-congrats.opus`],
    ];

    const allAudio = [...numberSounds, ...staticSounds];

    const preloadPromises = allAudio.map(([key, url]) =>
      this.preloadAudio(key, url)
        .then((audio) => {
          this.audioCache[key] = audio;
        })
        .catch((error) => {
          console.error(`Audio preload error for ${key}:`, error.message);
          this.audioCache[key] = new Audio(
            "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
          );
        })
    );

    await Promise.all(preloadPromises);
    console.log("Audio cache keys:", Object.keys(this.audioCache));
  }

  playSound(key, options = {}) {
    // Priority rules for result sounds
    if (key === "winner") {
      this.lastWinnerAt = Date.now();
      // Stop any pending/playing non-winner sound to avoid contradictory cues
      const lose = this.audioCache["you_didnt_win"];
      if (lose) {
        try {
          lose.pause();
          lose.currentTime = 0;
        } catch {}
      }
    } else if (key === "you_didnt_win") {
      // If a winner was played very recently, suppress the non-winner sound
      if (Date.now() - this.lastWinnerAt < 2000) {
        return;
      }
    }

    const audio = this.audioCache[key];
    if (!audio) {
      console.warn(`Audio for ${key} not found in cache`);
      return;
    }
    if (options.stop) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    audio.loop = options.loop || false;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => console.log(`Played sound: ${key}`))
      .catch((err) => console.error(`Error playing sound ${key}:`, err));
  }
}

export default new SoundService();
