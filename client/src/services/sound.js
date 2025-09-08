import API from "./axios";

class SoundService {
  constructor() {
    this.audioCache = {};
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
      ["jackpot_running", `/sounds?path=effects/jackpot-running.opus`],
      ["jackpot_congrats", `/sounds?path=effects/jackpot-congrats.opus`],
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
    const audio = this.audioCache[key];
    if (audio) {
      audio.currentTime = 0;
      audio
        .play()
        .then(() => console.log(`Played sound: ${key}`))
        .catch((err) => console.error(`Error playing sound ${key}:`, err));
    } else {
      console.warn(`Audio for ${key} not found in cache`);
    }
  }
}

export default new SoundService();
