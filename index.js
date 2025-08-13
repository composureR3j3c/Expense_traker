import fs from "fs";
import fetch from "node-fetch";
import 'dotenv/config';


const { BOT_TOKEN , SERVER_URL } = process.env;
const DATA_FILE = "./expenses.json";

let userExpenses = {};
const OFFSET_FILE = "./offset.txt";

function readOffset() {
  try {
    if (fs.existsSync(OFFSET_FILE)) {
      return parseInt(fs.readFileSync(OFFSET_FILE, "utf8"), 10);
    }
  } catch (err) {
    console.error("Error reading offset:", err);
  }
  return 0; // default if file not found
}

function writeOffset(offset) {
  try {
    fs.writeFileSync(OFFSET_FILE, offset.toString(), "utf8");
  } catch (err) {
    console.error("Error writing offset:", err);
  }
}


// Load saved expenses
if (fs.existsSync(DATA_FILE)) {
  userExpenses = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// Helper: save expenses
function saveExpenses() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userExpenses, null, 2));
}

// Polling
let offset = readOffset();
async function pollUpdates() {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${offset+1}`
  );
  console.log(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${offset+1}`
  )
  const data = await res.json();
  for (const update of data.result) {
    console.log("update",update.update_id)
    offset = update.update_id;
    writeOffset(offset);  
    if (!update.message || !update.message.text) continue;


    const text = update.message.text.trim();
    const chatId = update.message.chat.id;

    

    // List expenses
    if (text === "/list") {
      if (!userExpenses[chatId] || userExpenses[chatId].length === 0) {
        await sendMessage(chatId, "📒 No expenses yet");
        continue;
      }

      const list = userExpenses[chatId]
        .map(
          (e, i) =>
            `${i + 1}. ${e.amount} - ${e.category} (${new Date(
              e.date
            ).toLocaleString()})`
        )
        .join("\n");

      await sendMessage(chatId, `📒 Your expenses:\n\n${list}`);
      continue;
    }

    // Add expense
    const match = text.match(/^(\d+)\s+(\w+)$/);
    if (!match) {
      await sendMessage(
        chatId,
        "Please send expense in format: <amount> <category>. Example: 50 food"
      );
      continue;
    }

    const amount = parseInt(match[1], 10);
    const category = match[2].toLowerCase();

    if (!userExpenses[chatId]) userExpenses[chatId] = [];
    userExpenses[chatId].push({ amount, category, date: new Date() });
    saveExpenses();

    await sendMessage(
      chatId,
      `Recorded expense: ${amount} ETB for ${category}.`
    );
  }

  // Poll again
  setImmediate(pollUpdates);
}

// Helper: send a message
async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Start polling
pollUpdates();
console.log("💡 Bot is running using raw Telegram API...");
