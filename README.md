<p align="center">
  <img src="img/banner.png" alt="PromoForge Banner" width="800">
</p>

<p align="center">
  <b>Automate Telegram group promotion using Cloudflare Workers — fast, scalable, and multi-bot ready.</b>
</p>

<h1 align="center">PromoForge — Telegram Group Promotion Engine</h1>

<p align="center">
  <b>Forge Your Reach. Dominate Groups.</b><br>
  Developed by <a href="https://www.amitdas.site/">Amit Das</a>
</p>

---

## 🚀 Overview

PromoForge is a powerful **Telegram group promotion automation system** built using **Cloudflare Workers + Firebase**.

It allows you to:

- Automatically promote content inside Telegram groups
- Manage multiple bots with a single Worker
- Send media, stickers, and buttons
- Track groups dynamically via Firebase
- Auto-recover deleted group data
- Sync group metadata automatically

No servers required — runs fully on Cloudflare’s edge network.

---

## ⚡ Core Features

- Multi-bot support (token via URL param)
- Private `/start` auto response
- Auto message on bot join
- First-message trigger in groups
- Auto reply every N messages
- Inline buttons with global layout control
- Auto media detection (photo / video / gif / document)
- Telegram sticker support via file_id
- Firebase per-bot group storage
- Auto recreate group if deleted manually
- Auto sync group title & type
- Media permission fallback (auto send text if blocked)

---

## 🧠 How It Works

1. Telegram sends update to your Worker (via webhook)
2. Worker identifies bot using `?token=`
3. Worker checks group state in Firebase
4. Sends promotional media + inline buttons
5. Tracks message count & syncs metadata automatically

---

## 🌐 Webhook Setup

Set webhook per bot:

```bash
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://yourworker.workers.dev/?token=<BOT_TOKEN>
````

---

## 📦 Deployment

### 1️⃣ Deploy to Cloudflare Workers

Upload your `worker.js` file.

### 2️⃣ Set Firebase Realtime Database

Update:

```js
const FIREBASE_DB = "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_AUTH = "YOUR_FIREBASE_DATABASE_SECRET";
```

### 3️⃣ Configure Media & Buttons

Example:

```js
const PRIVATE_MEDIA = "https://example.com/video.gif";
const PRIVATE_TEXT = "🎬 Exclusive Video Just For You!";

const PRIVATE_BTN1 = { text: "Watch Now 🎬", url: "https://example.com/" };
const PRIVATE_BTN2 = { text: "More Videos ♻️", url: "https://t.me/${botUsername}?startgroup=start" };
```

---

## 👮 Add Bot to Group with Admin Permissions

If you want to add the bot to a group **with admin permissions automatically**, use the Telegram deep-link below.

```
https://t.me/${botUsername}?startgroup=&admin=post_messages+edit_messages+promote_members+delete_messages+restrict_members+invite_users+pin_messages+manage_video_chats+change_info
```

### Example Button

```js
const ADD_GROUP_BTN = {
  text: "Add Bot to Group 👮",
  url: "https://t.me/${botUsername}?startgroup=&admin=post_messages+edit_messages+promote_members+delete_messages+restrict_members+invite_users+pin_messages+manage_video_chats+change_info"
};
```

## 🔐 Requested Admin Permissions

The bot will request these permissions:

- `post_messages`
- `edit_messages`
- `promote_members`
- `delete_messages`
- `restrict_members`
- `invite_users`
- `pin_messages`
- `manage_video_chats`
- `change_info`

⚠️ **Note:** Telegram will still show a confirmation screen and the group owner/admin must approve the permissions.

---

## 🎛 Global Button Layout

```js
const BUTTON_LAYOUT = "vertical";
```

Options:

* `"vertical"` → buttons stacked
* `"horizontal"` → buttons side by side

---

## 🎞 Media Support

PromoForge auto-detects:

* `.jpg .png .webp` → Photo
* `.gif` → Animation
* `.mp4 .mov .webm` → Video
* Other URLs → Document
* `sticker=<FILE_ID>` → Telegram Sticker

Example:

```js
const PRIVATE_MEDIA = "sticker=CAACAgIAAxkBAA....";
```

---

## 🔁 Auto Reply Configuration

```js
const AUTO_REPLY_ENABLED = true;
const AUTO_REPLY_EVERY = 3;
```

Bot replies after every 3 user messages.

---

## 🗄 Firebase Structure

```
bots/
 └── BOT_TOKEN/
      └── groups/
           └── CHAT_ID/
                ├── title
                ├── type
                ├── join_sent
                ├── first_sent
                └── msg_count
```

---

## 🧩 Use Cases

### Telegram Growth Campaigns

Automate promotional content inside active groups.

### Affiliate Marketing

Auto distribute links with buttons.

### Multi-Bot Networks

Control multiple bots from one Worker.

### Content Rotation

Auto reply every N messages.

---

## 🔒 Security

* No external tracking
* No user data storage
* Uses official Telegram Bot API
* Runs on Cloudflare edge network

---

## ⚠️ Important

Bot must:

* Be added to group
* Have permission to send messages
* `/setprivacy` disabled via BotFather

---

## 📬 Support

<p align="center">
  <a href="https://t.me/AmitDas4321">
    <img src="https://img.shields.io/badge/Contact%20on%20Telegram-@AmitDas4321-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white">
  </a>
</p>

---

## 📜 License

MIT License © 2026 Amit Das

---

<p align="center">
  <b>Built with ⚡ using Cloudflare Workers</b><br>
  Made with ❤️ by <a href="https://amitdas.site">Amit Das</a>
</p>
