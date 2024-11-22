import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import "dotenv/config";
import axios from "axios";
import express from "express";
import { surahNames } from "./src/utils";

interface QuranVerse {
  chapter: number;
  verse: number;
  text: string;
}

const bot = new Bot((process.env.BOT_TOKEN as string)!);
let quranData: QuranVerse[] = [];

async function fetchQoranData() {
  try {
    const response = await axios.get(
      "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/uzb-muhammadsodikmu.json"
    );

    // Response strukturasini tekshiramiz
    console.log("Response structure:", response.data);

    // API dan kelgan ma'lumotlar massiv formatida bo'lishi kerak
    if (response.data.quran) {
      quranData = response.data.quran; // agar ma'lumotlar quran property ichida bo'lsa
    } else if (Array.isArray(response.data)) {
      quranData = response.data;
    } else {
      console.error("Unexpected data format:", response.data);
      quranData = [];
    }

    console.log(
      "Qur'on ma'lumotlari yuklandi. Birinchi element:",
      quranData[0]
    );
  } catch (error) {
    console.error("Ma'lumotlarni yuklashda xatolik:", error);
    quranData = [];
  }
}

fetchQoranData();

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🔍 Сура танлаш", "select_surah_1")
    .text("ℹ️ Маълумот", "about");

  await ctx.reply(
    "🌙 *Ассалому алайкум!*\n\n" +
      "Қуръони Карим бўйича қидирув ботига хуш келибсиз.\n" +
      "Қуйидаги тугмалардан бирини танланг:",
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

bot.callbackQuery(/^select_surah_(\d+)$/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1]);
    const perPage = 10;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const keyboard = new InlineKeyboard();

    const currentSurahs = surahNames.slice(start, end);
    for (let i = 0; i < currentSurahs.length; i += 2) {
      const row = currentSurahs.slice(i, i + 2);
      row.forEach((surah) => {
        const surahNum = surah.split(".")[0];
        keyboard.text(surah, `surah_${surahNum}`);
      });
      keyboard.row();
    }

    if (start > 0) {
      keyboard.text("⬅️ Олдинги", `select_surah_${page - 1}`);
    }
    if (end < surahNames.length) {
      keyboard.text("Кейинги ➡️", `select_surah_${page + 1}`);
    }

    await ctx.editMessageText("*Сурани танланг:*", {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error) {
    if (error === "Bad Request: message is not modified") {
      await ctx.answerCallbackQuery(); // Just acknowledge the callback
    } else {
      console.error("Error in select_surah handler:", error);
      await ctx.answerCallbackQuery({
        text: "Хатолик юз берди. Илтимос, қайтадан уриниб кўринг.",
        show_alert: true,
      });
    }
  }
});

bot.callbackQuery(/^surah_(\d+)$/, async (ctx) => {
  try {
    const surahNumber = parseInt(ctx.match[1]);
    console.log(surahNumber);

    const verses = quranData.filter((verse) => verse.chapter === surahNumber);
    console.log(verses);

    const keyboard = new InlineKeyboard();

    for (let i = 0; i < Math.min(verses.length, 20); i += 5) {
      const row = verses.slice(i, i + 5);
      row.forEach((verse) => {
        keyboard.text(
          verse.verse.toString(),
          `verse_${surahNumber}_${verse.verse}`
        );
      });
      keyboard.row();
    }

    if (verses.length > 20) {
      keyboard.text("Кўпроқ оятлар ➡️", `more_verses_${surahNumber}_20`);
    }

    keyboard.row().text("🔙 Суралар рўйхати", "select_surah_1");

    await ctx.editMessageText(
      `*${surahNumber}-сура, оятни танланг:*\n` +
        `_Жами оятлар сони: ${verses.length}_`,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    if (error === "Bad Request: message is not modified") {
      await ctx.answerCallbackQuery();
    } else {
      console.error("Error in surah handler:", error);
      await ctx.answerCallbackQuery({
        text: "Хатолик юз берди. Илтимос, қайтадан уриниб кўринг.",
        show_alert: true,
      });
    }
  }
});

// Mavjud surah handleringizdan keyin quyidagi kodni qo'shing:
bot.callbackQuery(/^more_verses_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const surahNumber = parseInt(ctx.match[1]);
    const startVerse = parseInt(ctx.match[2]);

    const verses = quranData.filter((verse) => verse.chapter === surahNumber);
    const keyboard = new InlineKeyboard();

    // Keyingi 20 ta oyatni ko'rsatish
    for (
      let i = startVerse;
      i < Math.min(verses.length, startVerse + 20);
      i += 5
    ) {
      const row = verses.slice(i, Math.min(i + 5, verses.length));
      row.forEach((verse) => {
        keyboard.text(
          verse.verse.toString(),
          `verse_${surahNumber}_${verse.verse}`
        );
      });
      keyboard.row();
    }

    // Agar yana oyatlar qolgan bo'lsa, "Ko'proq" tugmasini ko'rsatish
    if (startVerse + 20 < verses.length) {
      keyboard.text(
        "Кўпроқ оятлар ➡️",
        `more_verses_${surahNumber}_${startVerse + 20}`
      );
    }

    // Orqaga qaytish tugmasi
    keyboard
      .row()
      .text(
        "⬅️ Олдинги",
        `more_verses_${surahNumber}_${Math.max(0, startVerse - 20)}`
      );
    keyboard.text("🔙 Суралар рўйхати", "select_surah_1");

    await ctx.editMessageText(
      `*${surahNumber}-сура, оятни танланг:*\n` +
        `_Жами оятлар сони: ${verses.length}_\n` +
        `_Ҳозирги оятлар: ${startVerse + 1}-${Math.min(
          startVerse + 20,
          verses.length
        )}_`,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    console.error("Error in more_verses handler:", error);
    await ctx.answerCallbackQuery({
      text: "Хатолик юз берди. Илтимос, қайтадан уриниб кўринг.",
      show_alert: true,
    });
  }
});

bot.callbackQuery(/^verse_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const surahNumber = parseInt(ctx.match[1]);
    const verseNumber = parseInt(ctx.match[2]);

    const verse = quranData.find(
      (v) => v.chapter === surahNumber && v.verse === verseNumber
    );

    if (verse) {
      const keyboard = new InlineKeyboard();

      if (verseNumber > 1) {
        keyboard.text(
          "⬅️ Олдинги оят",
          `verse_${surahNumber}_${verseNumber - 1}`
        );
      }

      const nextVerse = quranData.find(
        (v) => v.chapter === surahNumber && v.verse === verseNumber + 1
      );
      if (nextVerse) {
        keyboard.text(
          "Кейинги оят ➡️",
          `verse_${surahNumber}_${verseNumber + 1}`
        );
      }

      keyboard.row().text("🔙 Оятлар рўйхати", `surah_${surahNumber}`);

      await ctx.editMessageText(
        `*${surahNumber}-сура, ${verseNumber}-оят*\n\n` +
          `${verse.text}\n\n` +
          `_Манба: Муҳаммад Содиқ тафсири_`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    }
  } catch (error) {
    if (error === "Bad Request: message is not modified") {
      await ctx.answerCallbackQuery();
    } else {
      console.error("Error in verse handler:", error);
      await ctx.answerCallbackQuery({
        text: "Хатолик юз берди. Илтимос, қайтадан уриниб кўринг.",
        show_alert: true,
      });
    }
  }
});

bot.catch((err) => {
  console.error("Global error handler caught:", err);
});

// Ma'lumot
bot.callbackQuery("about", async (ctx) => {
  const keyboard = new InlineKeyboard().text(
    "🔙 Асосий меню",
    "select_surah_1"
  );

  await ctx.editMessageText(
    "*Қуръони Карим бўйича қидирув боти*\n\n" +
      "Ушбу бот Қуръони Карим оятларини ўқиш ва ўрганиш учун яратилган.\n\n" +
      "• Манба: Муҳаммад Содиқ тафсири\n" +
      "• API: fawazahmed0/quran-api\n" +
      "• Версия: 1.0\n\n" +
      '_Ботдан фойдаланиш учун "Сура танлаш" тугмасини босинг._',
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});

// Express serverini yaratish
const app = express();
app.use(express.json());

app.use(webhookCallback(bot, "express"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
