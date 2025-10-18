const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

// --- Discord bot setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const TOKEN = process.env.DISCORD_TOKEN;
const app = express();
const PORT = 3000;

// --- Load keys from file ---
let keys = {};
if (fs.existsSync('keys.json')) {
  keys = JSON.parse(fs.readFileSync('keys.json'));
}

// --- Save keys to file ---
function saveKeys() {
  fs.writeFileSync('keys.json', JSON.stringify(keys, null, 2));
}

// --- API for menu authentication ---
app.get('/checkkey', (req, res) => {
  const { key, hwid } = req.query;
  if (!key) return res.json({ valid: false, error: "Thiếu key" });

  const data = keys[key];
  if (!data) return res.json({ valid: false, error: "Key không tồn tại" });

  // Kiểm tra hết hạn
  const now = Date.now();
  if (now > data.expireAt) {
    delete keys[key];
    saveKeys();
    return res.json({ valid: false, error: "Key đã hết hạn" });
  }

  // Kiểm tra HWID
  if (!data.hwid) {
    // Nếu key chưa gắn với máy nào → lưu lại HWID đầu tiên
    data.hwid = hwid;
    saveKeys();
    return res.json({ valid: true, message: "Key hợp lệ (đã gắn HWID)" });
  } else if (data.hwid === hwid) {
    // Máy cũ dùng lại key này
    return res.json({ valid: true, message: "Key hợp lệ" });
  } else {
    // Máy khác dùng key này
    return res.json({ valid: false, error: "Key đã được dùng cho máy khác" });
  }
});

// --- Start API ---
app.listen(PORT, () => console.log(`🌐 API đang chạy tại http://localhost:${PORT}`));

// --- Discord bot events ---
client.on('ready', () => {
  console.log(`✅ Bot ${client.user.tag} đã online!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- !help ---
  if (command === '!help') {
    const embed = new EmbedBuilder()
      .setColor('#fcd303')
      .setTitle('❓ Các lệnh KeyBot')
      .setDescription(`
\`!key <key> <số ngày>\` — Tạo key cho 1 máy  
\`!keymulti <key> <số ngày> <số máy>\` — (chưa kích hoạt multi)  
\`!delete <key>\` — Xóa key  
\`!list\` — Hiển thị danh sách key đang hoạt động  
      `)
      .setFooter({ text: 'KEYAUTH DualForce VN' });
    return message.reply({ embeds: [embed] });
  }

  // --- !key ---
  if (command === '!key') {
    if (args.length < 2) {
      return message.reply('⚠️ Dùng đúng cú pháp: `!key <key> <số ngày>`');
    }

    const [key, days] = args;
    const now = Date.now();
    const expireAt = now + parseInt(days) * 24 * 60 * 60 * 1000;

    keys[key] = {
      days: parseInt(days),
      createdAt: now,
      expireAt,
      hwid: null,
    };
    saveKeys();

    const embed = new EmbedBuilder()
      .setColor('#00ff7f')
      .setTitle('✅ Đã tạo key')
      .addFields(
        { name: '🔑 Key', value: key },
        { name: '📆 Hết hạn', value: new Date(expireAt).toLocaleString() }
      );
    return message.reply({ embeds: [embed] });
  }

  // --- !delete ---
  if (command === '!delete') {
    const key = args[0];
    if (!key || !keys[key]) return message.reply('⚠️ Key không tồn tại!');
    delete keys[key];
    saveKeys();
    return message.reply(`🗑️ Đã xóa key \`${key}\``);
  }

  // --- !list ---
  if (command === '!list') {
    if (Object.keys(keys).length === 0)
      return message.reply('❌ Không có key nào hoạt động.');

    const list = Object.entries(keys)
      .map(([k, v]) => {
        const left = Math.ceil((v.expireAt - Date.now()) / (1000 * 60 * 60 * 24));
        return `${k} - Còn ${left > 0 ? left : 0} ngày - ${v.hwid ? "🖥️ Đã dùng" : "🟢 Chưa dùng"}`;
      })
      .join('\n');

    return message.reply('📋 Danh sách key:\n' + list);
  }

  // --- Khi sai lệnh ---
  if (command.startsWith('!')) {
    return message.reply('⚠️ Lệnh không hợp lệ! Dùng `!help` để xem danh sách lệnh.');
  }
});

client.login('MTQyNzg2OTEyOTIzNDE4NjM2Mw.G4VRmx.v4XkI35e4RsujMs9XK5ZcUzwwJCqdbNIwaPlgk');
