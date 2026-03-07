/**
 * Multi-bot Cloudflare Worker
 * - token from ?token=
 * - auto get botUsername from getMe
 * - You can manually use: "https://t.me/${botUsername}?startgroup=start" in ANY button url
 * - Worker will replace ${botUsername} automatically in all buttons
 * - Global layout switch: horizontal / vertical for ALL messages
 * - Separate messages + separate 2 buttons each
 * - Auto media type by URL extension; empty media => text
 * - Supports Telegram sticker file_id via: "sticker=<FILE_ID>"
 * - Firebase per-bot group storage
 * - Bot removed => delete group from DB
 * - If Firebase group data deleted manually, next group message will recreate it (no need re-add)
 * - If group title/type changes, auto sync to Firebase
 *
 * Webhook per bot:
 * https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://yourwebsite.workers.dev/?token=<BOT_TOKEN>
 *
 * IMPORTANT:
 * For group message triggers, BotFather: /setprivacy -> Disable
 */

const FIREBASE_DB =
  "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_AUTH = "YOUR_FIREBASE_DATABASE_SECRET";

/* =========================
   GLOBAL BUTTON LAYOUT
========================= */
// "horizontal" => same line, "vertical" => up/down
const BUTTON_LAYOUT = "vertical";

/* =========================
   1) PRIVATE /start
========================= */
// Use URL:
// const PRIVATE_MEDIA = "https://example.com/a.gif";
// OR Telegram sticker file_id:
// const PRIVATE_MEDIA = "sticker=CAACAgIAAxkBAA....";
const PRIVATE_MEDIA = "https://raw.githubusercontent.com/AmitDas4321/PromoForge/refs/heads/main/img/example.png";
const PRIVATE_TEXT = `🎬 Exclusive Video Just For You!`;

const PRIVATE_BTN1 = { text: "Watch Video 🎬", url: "https://example.com/" };
const PRIVATE_BTN2 = {
  text: "See another video ♻️",
  url: "https://t.me/${botUsername}?startgroup=start"
};

/* =========================
   2) JOIN (bot added to group)
========================= */
const JOIN_MEDIA = "https://raw.githubusercontent.com/AmitDas4321/PromoForge/refs/heads/main/img/example.png";
const JOIN_TEXT = `🎬 Exclusive Video Just For You!`;

const JOIN_BTN1 = {
  text: "Watch Video 🎬",
  url: "https://t.me/${botUsername}?startgroup=start"
};
const JOIN_BTN2 = {
  text: "See another video ♻️",
  url: "https://t.me/${botUsername}?startgroup=start"
};

/* =========================
   3) FIRST user message (once)
========================= */
const FIRST_MEDIA = "https://raw.githubusercontent.com/AmitDas4321/PromoForge/refs/heads/main/img/example.png";
const FIRST_TEXT = `🎬 Exclusive Video Just For You!`;

const FIRST_BTN1 = {
  text: "Watch Video 🎬",
  url: "https://t.me/${botUsername}?startgroup=start"
};
const FIRST_BTN2 = {
  text: "See another video ♻️",
  url: "https://t.me/${botUsername}?startgroup=start"
};

/* =========================
   4) AUTO REPLY every N messages
========================= */
const AUTO_REPLY_ENABLED = true;
const AUTO_REPLY_EVERY = 3;

const AUTO_MEDIA = "https://raw.githubusercontent.com/AmitDas4321/PromoForge/refs/heads/main/img/example.png";
const AUTO_TEXT = `🎬 Exclusive Video Just For You!`;

const AUTO_BTN1 = { text: "Watch Video 🎬", url: "https://t.me/play_sq_bot" };
const AUTO_BTN2 = {
  text: "See another video ♻️",
  url: "https://t.me/${botUsername}?startgroup=start"
};

/* =========================
   WORKER
========================= */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const BOT_TOKEN = url.searchParams.get("token");

    if (!BOT_TOKEN) return new Response("Missing token param", { status: 400 });
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    /** @type {any} */
    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // get bot info (id + username)
    const botInfo = await getBotInfo(BOT_TOKEN);
    if (!botInfo) return new Response("OK", { status: 200 });

    const botId = botInfo.id;
    const botUsername = botInfo.username;

    // Build each message's inline_keyboard with global layout + auto ${botUsername} replace
    const PRIVATE_BUTTONS = build2Buttons(PRIVATE_BTN1, PRIVATE_BTN2, botUsername);
    const JOIN_BUTTONS = build2Buttons(JOIN_BTN1, JOIN_BTN2, botUsername);
    const FIRST_BUTTONS = build2Buttons(FIRST_BTN1, FIRST_BTN2, botUsername);
    const AUTO_BUTTONS = build2Buttons(AUTO_BTN1, AUTO_BTN2, botUsername);

    const msg = update?.message;

    // Keep Firebase group meta synced + recreate if missing (on any group message)
    if (msg?.chat?.id && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      await ensureGroupExistsAndSyncMeta(BOT_TOKEN, msg.chat);
    }

    // 0) Private /start
    if (msg?.chat?.type === "private" && typeof msg?.text === "string") {
      const t = msg.text.trim();
      if (t === "/start" || t.startsWith("/start ")) {
        await sendAuto(BOT_TOKEN, msg.chat.id, PRIVATE_MEDIA, PRIVATE_TEXT, PRIVATE_BUTTONS);
        return new Response("OK", { status: 200 });
      }
    }

    // 1) Bot added to group
    const addedChatId = getBotAddedChatId(update, botId);
    if (addedChatId) {
      await saveGroupIfMissing(BOT_TOKEN, addedChatId, update);

      // sync meta on join events too
      const joinChat = update?.my_chat_member?.chat || update?.message?.chat;
      if (joinChat?.id) await ensureGroupExistsAndSyncMeta(BOT_TOKEN, joinChat);

      const state = await getGroupState(BOT_TOKEN, addedChatId);
      if (state && !state.join_sent) {
        await sendAuto(BOT_TOKEN, addedChatId, JOIN_MEDIA, JOIN_TEXT, JOIN_BUTTONS);
        await updateGroup(BOT_TOKEN, addedChatId, { join_sent: true });
      }
      return new Response("OK", { status: 200 });
    }

    // 2) Bot removed
    const removedChatId = getBotRemovedChatId(update, botId);
    if (removedChatId) {
      await deleteGroup(BOT_TOKEN, removedChatId);
      return new Response("OK", { status: 200 });
    }

    // 3) Group user messages
    if (msg?.chat?.id && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      if (msg.from?.is_bot) return new Response("OK", { status: 200 });

      const chatId = msg.chat.id;

      // If Firebase record was deleted manually, recreate now (no need re-add)
      let state = await getGroupState(BOT_TOKEN, chatId);
      if (!state) {
        await createOrResetGroupFromChat(BOT_TOKEN, msg.chat);
        state = await getGroupState(BOT_TOKEN, chatId);
        if (!state) return new Response("OK", { status: 200 });
      }

      // first user message once
      if (!state.first_sent) {
        await sendAuto(BOT_TOKEN, chatId, FIRST_MEDIA, FIRST_TEXT, FIRST_BUTTONS);
        await updateGroup(BOT_TOKEN, chatId, { first_sent: true });
      }

      // auto reply every N
      if (AUTO_REPLY_ENABLED && Number(AUTO_REPLY_EVERY) > 0) {
        const current = Number(state.msg_count || 0) + 1;
        await updateGroup(BOT_TOKEN, chatId, { msg_count: current });

        if (current % Number(AUTO_REPLY_EVERY) === 0) {
          await sendAuto(BOT_TOKEN, chatId, AUTO_MEDIA, AUTO_TEXT, AUTO_BUTTONS);
        }
      }
    }

    return new Response("OK", { status: 200 });
  }
};

/* =========================
   BUTTON HELPERS
========================= */

// Replace ${botUsername} in any URL string (no replaceAll warnings)
function resolveUrl(url, botUsername) {
  return String(url || "").split("${botUsername}").join(botUsername);
}

function normalizeBtn(btn, botUsername) {
  return {
    text: String(btn?.text || ""),
    url: resolveUrl(btn?.url || "", botUsername),
    ...(btn?.style ? { style: btn.style } : {})
  };
}

// Global layout for ALL messages (2 buttons)
function build2Buttons(btn1, btn2, botUsername) {
  const b1 = normalizeBtn(btn1, botUsername);
  const b2 = normalizeBtn(btn2, botUsername);

  if (BUTTON_LAYOUT === "vertical") return [[b1], [b2]];
  return [[b1, b2]];
}

/* =========================
   TELEGRAM HELPERS
========================= */

async function getBotInfo(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const r = data?.result;
  if (!r?.id || !r?.username) return null;

  return { id: r.id, username: r.username };
}

/**
 * sendAuto supports:
 * - "sticker=<FILE_ID>" => sendSticker
 * - URL or file_id => auto guess .gif/.jpg/.mp4 etc
 * - If media blocked in group => fallback to sendMessage (text only) with buttons
 */
async function sendAuto(token, chatId, media, text, inline_keyboard) {
  const reply_markup = inline_keyboard ? { inline_keyboard } : undefined;

  // No media => sendMessage
  if (!media || String(media).trim() === "") {
    return sendText(token, chatId, text, reply_markup);
  }

  const m = String(media).trim();

  // Telegram sticker via file_id
  if (m.startsWith("sticker=")) {
    const fileId = m.slice(8).trim();

    const res = await tg(token, "sendSticker", {
      chat_id: chatId,
      sticker: fileId,
      ...(reply_markup ? { reply_markup } : {})
    });

    // if sticker blocked => send text only
    if (!res.ok && isMediaPermissionError(res.errorText)) {
      return sendText(token, chatId, text, reply_markup);
    }

    return res;
  }

  // Normal URL/file logic
  const kind = guessMediaKind(m);

  let method = "sendPhoto";
  const payload = /** @type {any} */ ({
    chat_id: chatId,
    caption: text,
    ...(reply_markup ? { reply_markup } : {})
  });

  if (kind === "gif") {
    method = "sendAnimation";
    payload.animation = m;
  } else if (kind === "photo") {
    method = "sendPhoto";
    payload.photo = m;
  } else if (kind === "video") {
    method = "sendVideo";
    payload.video = m;
  } else {
    method = "sendDocument";
    payload.document = m;
  }

  const res = await tg(token, method, payload);

  // Media blocked => fallback to text
  if (!res.ok && isMediaPermissionError(res.errorText)) {
    return sendText(token, chatId, text, reply_markup);
  }

  return res;
}

async function sendText(token, chatId, text, reply_markup) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...(reply_markup ? { reply_markup } : {})
  });
}

function isMediaPermissionError(errorText) {
  if (!errorText) return false;
  const t = String(errorText);
  return (
    t.includes("not enough rights") ||
    t.includes("have no rights") ||
    t.includes("CHAT_SEND_MEDIA_FORBIDDEN") ||
    t.includes("CHAT_SEND_PHOTOS_FORBIDDEN") ||
    t.includes("CHAT_SEND_VIDEOS_FORBIDDEN") ||
    t.includes("CHAT_SEND_DOCUMENTS_FORBIDDEN") ||
    t.includes("CHAT_SEND_ANIMATIONS_FORBIDDEN") ||
    t.includes("VOICE_MESSAGES_FORBIDDEN") ||
    t.includes("STICKERS_FORBIDDEN")
  );
}

function guessMediaKind(media) {
  const s = String(media).trim().toLowerCase();
  const qless = s.split("?")[0];

  if (qless.endsWith(".gif")) return "gif";

  if (
    qless.endsWith(".jpg") ||
    qless.endsWith(".jpeg") ||
    qless.endsWith(".png") ||
    qless.endsWith(".webp")
  ) return "photo";

  if (
    qless.endsWith(".mp4") ||
    qless.endsWith(".mov") ||
    qless.endsWith(".mkv") ||
    qless.endsWith(".webm")
  ) return "video";

  if (s.startsWith("http://") || s.startsWith("https://")) return "document";

  // file_id fallback (can't detect)
  return "photo";
}

/**
 * tg() returns:
 *  { ok: true, data }
 *  { ok: false, errorText }
 */
async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = String(await res.text().catch(() => ""));

  if (!res.ok) {
    console.log(method, "failed:", res.status, text);
    return { ok: false, errorText: text };
  }

  return { ok: true, data: text };
}

/* =========================
   DETECTION
========================= */

function getBotAddedChatId(update, botId) {
  const mcm = update?.my_chat_member;
  if (mcm && mcm.new_chat_member?.user?.id === botId) {
    const st = mcm.new_chat_member?.status;
    if (st === "member" || st === "administrator") return mcm.chat?.id;
  }

  const msg = update?.message;
  if (msg?.new_chat_members?.length) {
    const added = msg.new_chat_members.some((u) => u.id === botId);
    if (added) return msg.chat?.id;
  }

  return null;
}

function getBotRemovedChatId(update, botId) {
  const mcm = update?.my_chat_member;
  if (mcm && mcm.new_chat_member?.user?.id === botId) {
    const st = mcm.new_chat_member?.status;
    if (st === "left" || st === "kicked") return mcm.chat?.id;
  }
  return null;
}

/* =========================
   FIREBASE (PER BOT)
========================= */

function fbUrl(token, path) {
  const base = FIREBASE_DB.replace(/\/$/, "");
  const auth = FIREBASE_AUTH ? `?auth=${encodeURIComponent(FIREBASE_AUTH)}` : "";
  return `${base}/bots/${encodeURIComponent(token)}${path}.json${auth}`;
}

async function saveGroupIfMissing(token, chatId, update) {
  const existing = await getGroupState(token, chatId);
  if (existing) return;

  const chat =
    update?.my_chat_member?.chat ||
    update?.message?.chat ||
    { id: chatId, title: "", type: "" };

  await createOrResetGroupFromChat(token, chat);
}

async function createOrResetGroupFromChat(token, chat) {
  const chatId = chat?.id;
  if (!chatId) return;

  const data = {
    chat_id: chatId,
    title: String(chat?.title || ""),
    type: String(chat?.type || ""),
    join_sent: false,
    first_sent: false,
    msg_count: 0
  };

  await fetch(fbUrl(token, `/groups/${chatId}`), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function getGroupState(token, chatId) {
  const res = await fetch(fbUrl(token, `/groups/${chatId}`));
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data || null;
}

async function updateGroup(token, chatId, patch) {
  await fetch(fbUrl(token, `/groups/${chatId}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  });
}

async function deleteGroup(token, chatId) {
  await fetch(fbUrl(token, `/groups/${chatId}`), { method: "DELETE" });
}

/* =========================
   ENSURE GROUP EXISTS + SYNC META (title/type)
========================= */

async function ensureGroupExistsAndSyncMeta(token, chat) {
  const chatId = chat?.id;
  if (!chatId) return;

  const state = await getGroupState(token, chatId);

  // If missing in Firebase (manually deleted), recreate immediately
  if (!state) {
    await createOrResetGroupFromChat(token, chat);
    return;
  }

  // Sync title/type if changed
  const title = String(chat?.title || "");
  const type = String(chat?.type || "");

  const oldTitle = String(state.title || "");
  const oldType = String(state.type || "");

  if (title !== oldTitle || type !== oldType) {
    await updateGroup(token, chatId, { title, type });
  }
}
