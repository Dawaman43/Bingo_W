class SoundService {
  constructor() {
    this.audioCache = {};
  }

  preloadAudio(key, url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.oncanplaythrough = () => {
        console.log(`Successfully loaded audio: ${key} from ${url}`);
        resolve(audio);
      };
      audio.onerror = (err) => {
        console.error(`Failed to load audio: ${key} from ${url}`, err);
        reject(new Error(`Failed to load ${url}`));
      };
      audio.load();
    });
  }

  async preloadSounds(language) {
    const numberSounds = Array.from({ length: 75 }, (_, i) => {
      const num = i + 1;
      return [
        `number_${num}`,
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/${num}.opus`,
      ];
    });

    const staticSounds = [
      [
        "game_start",
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/started${language === "am" ? "ahm" : "oromic"}.opus`,
      ],
      [
        "game_pause",
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/paused${language === "am" ? "amh" : "oromic"}.opus`,
      ],
      [
        "game_finish",
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/finish${language === "am" ? "amh" : "oromic"}.opus`,
      ],
      [
        "winner",
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/win${language === "am" ? "amh" : "oromic"}.opus`,
      ],
      [
        "you_didnt_win",
        `http://localhost:4000/api/sounds?path=${
          language === "am" ? "amharic" : "voices"
        }/locked${language === "am" ? "amh" : "oromic"}.opus`,
      ],
      ["shuffle", `http://localhost:4000/api/sounds?path=effects/shuffle.opus`],
      [
        "jackpot_running",
        `http://localhost:4000/api/sounds?path=effects/jackpot-running.opus`,
      ],
      [
        "jackpot_congrats",
        `http://localhost:4000/api/sounds?path=effects/jackpot-congrats.opus`,
      ],
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

  playSound(key) {
    console.log(`Attempting to play sound: ${key}`);
    const audio = this.audioCache[key];
    if (audio) {
      audio.currentTime = 0;
      audio
        .play()
        .then(() => console.log(`Successfully played sound: ${key}`))
        .catch((err) => console.error(`Error playing sound ${key}:`, err));
    } else {
      console.warn(`Audio for ${key} not found in cache`);
    }
  }
}

export default new SoundService();
