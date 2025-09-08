import React, { createContext, useState, useMemo } from "react";

export const LanguageContext = createContext();

const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("am"); // Default to Amharic

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "am" ? "or" : "am"));
  };

  const value = useMemo(
    () => ({
      language,
      toggleLanguage,
      translations: {
        am: {
          gameSettings: "የጨዋታ ቅንብሮች",
          language: "ቋንቋ",
          classicBingo: "ክላሲክ ቢንጎ",
          lastCalled: "መጨረሻ ጥሪ",
          betMoney: "ውርርድ ገንዘብ",
          winMoney: "የሽልማት ገንዘብ",
          called: "ጥሪ ተደርጓል",
          pattern: "ቅጥ",
          house: "ቤት",
          play: "ተጫወት",
          autoCall: "ራስ-ሰር ጥሪ",
          next: "ቀጣይ",
          finish: "ጨርስ",
          shuffle: "ቅደም ተከተል ቀይር",
          check: "ፈትሽ",
          timer: "ጊዜ ቆጣሪ",
          jackpot: "ጃክፖት",
          winnerId: "አሸናፊ መለያ",
          prize: "ሽልማት",
          drawDate: "የመሳል ቀን",
          runJackpot: "ጃክፖት አስኬድ",
          winner: "አሸናፊ!",
          cardWon: "ካርድ ጨዋታውን አሸንፏል!",
          close: "ዝጋ",
          home: "መነሻ",
          selectCard: "ካርድ ምረጥ",
          report: "ሪፖርት",
          startGame: "ጨዋታ ጀምር",
          selected: "ተመርጧል",
          select: "ምረጥ",
          singleLine: "ነጠላ መስመር",
          doubleLine: "ድርብ መስመር",
          fullHouse: "ሙሉ ቤት",
          fixInfo: "መረጃ አስተካክል",
          fixInfoMessage: "እባክዎ የጨዋታ ቅንብሮችን ያረጋግጡ።",
          settingsContent: "የቅንብሮች ይዘት እዚህ ይገኛል...",
          enterBetAmount: "ውርርድ ገንዘብ ያስገቡ (ብር)",
          enterHousePercentage: "የቤት መቶኛ ያስገቡ",
          enterNumber: "ቁጥር ያስገቡ (1-75)",
          callManual: "በእጅ ጥሪ",
          invalidBetAmount: "እባክዎ ትክክለኛ ውርርድ ገንዘብ ያስገቡ",
          invalidHousePercentage: "እባክዎ ትክክለኛ የቤት መቶኛ ያስገቡ",
          noCardsSelected: "እባክዎ ቢያንስ አንድ ካርድ ይምረጡ",
          gameStarted: "ጨዋታ በተሳካ ሁኔታ ተጀምሯል!",
          errorStartingGame: "ጨዋታ ለመጀመር ስህተት፡ ",
          invalidNumber: "እባክዎ በ1 እና 75 መካከል ያለ ትክክለኛ ቁጥር ያስገቡ",
          errorCallingNumber: "ቁጥር በመጥራት ላይ ስህተት",
          notBingo: "ገና ቢንጎ አይደለም",
          errorCheckingBingo: "ቢንጎ በመፈተሽ ላይ ስህተት",
          errorSelectingWinner: "አሸናፊ በመምረጥ ላይ ስህተት",
          loading: "በመጫን ላይ...",
        },
        or: {
          gameSettings: "Teessuma Jechoota",
          language: "Afaan",
          classicBingo: "Bingo Klassikaa",
          lastCalled: "Odeeffannoo Isa Dhumaa",
          betMoney: "Maallaqa Kaffaltii",
          winMoney: "Maallaqa Galii",
          called: "Waamame",
          pattern: "Qaabee",
          house: "Mana",
          play: "Taphachuu",
          autoCall: "Ofiitti Waamuu",
          next: "Itti Aanaa",
          finish: "Xumuru",
          shuffle: "Qaxxaamuru",
          check: "Ilaali",
          timer: "Sa’aatii",
          jackpot: "Jaakpootii",
          winnerId: "ID Galtuu",
          prize: "Baasii",
          drawDate: "Guyyaa Fudhatama",
          runJackpot: "Jaakpootii Kaasu",
          winner: "Galtuu!",
          cardWon: "Kaardii Taphichaa Jabeesse!",
          close: "Cufu",
          home: "Fuula Durii",
          selectCard: "Kaardii Filuu",
          report: "Gabaasa",
          startGame: "Taphichaa Jalqabi",
          selected: "Filatame",
          select: "Filuu",
          singleLine: "Saree Tokkoffaa",
          doubleLine: "Saree Lamaan",
          fullHouse: "Mana Guutuu",
          fixInfo: "Odeeffannoo Sirreessuu",
          fixInfoMessage: "Mee teessuma taphichaa keessummaa ilaali.",
          settingsContent: "Qabiyyee teessumaa kana keessa jira...",
          enterBetAmount: "Maallaqa kaffaltii galchuu (BIRR)",
          enterHousePercentage: "Dhibbantaa mana galchuu",
          enterNumber: "Lakkoofsa galchuu (1-75)",
          callManual: "Waamuu Qixxa",
          invalidBetAmount: "Mee maallaqa kaffaltii sirrii galchuu",
          invalidHousePercentage: "Mee dhibbantaa mana sirrii galchuu",
          noCardsSelected: "Mee kaardii tokko ykn isaa ol filuu",
          gameStarted: "Taphichaan milkaaʼinaan jalqabame!",
          errorStartingGame: "Taphichaa jalqabuu keessatti dogoggora: ",
          invalidNumber: "Mee lakkoofsa sirrii 1 fi 75 gidduu galchuu",
          errorCallingNumber: "Lakkoofsa waamuu keessatti dogoggora",
          notBingo: "Amma biingoo miti",
          errorCheckingBingo: "Biingoo ilaalu keessatti dogoggora",
          errorSelectingWinner: "Galtuu filuu keessatti dogoggora",
          loading: "Feʼamaa jira...",
        },
      },
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
