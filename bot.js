"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
require("dotenv/config");
const bot = new grammy_1.Bot(process.env.BOT_TOKEN);
bot.command("start", (ctx) => ctx.reply("Hello!"));
bot.on("message", (ctx) => ctx.reply("Got another message!"));
bot.start();
