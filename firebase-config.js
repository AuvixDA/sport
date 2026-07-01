// Общий конфиг Firebase для всех страниц
// Используем модульный SDK через CDN (type="module" в html)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  remove,
  update,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Полный конфиг проекта (взят из Firebase Console -> Project settings -> General)
const firebaseConfig = {
  apiKey: "AIzaSyACRSr95HJsauRDmeXACUx9VAEhbhVJnyc",
  authDomain: "sport-9c35b.firebaseapp.com",
  databaseURL: "https://sport-9c35b-default-rtdb.firebaseio.com",
  projectId: "sport-9c35b",
  storageBucket: "sport-9c35b.firebasestorage.app",
  messagingSenderId: "947683329332",
  appId: "1:947683329332:web:354a18619394d1f294d161"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Держим сессию в localStorage, чтобы человек не разлогинивался при закрытии вкладки
setPersistence(auth, browserLocalPersistence).catch(() => {});

// UID тренерского аккаунта. Используется на клиенте, чтобы понять,
// что вошёл именно тренер (сама защита данных обеспечивается Security Rules,
// это значение здесь — только для UI-логики, не для безопасности).
const TRAINER_UID = "n0KcxX53nAfJ9FTPaqWgOBgsU0J2";

// UID аккаунта владельца сайта (админа). Отдельный человек, не тренер.
// По той же схеме, что и TRAINER_UID — значение здесь только для UI-логики,
// реальная защита данных — в Security Rules.
const ADMIN_UID = "1bGnkjhRzRVqKOev7SFXmUSedir2";

// Ники хранятся как "домен" синтетической почты для Firebase Auth,
// это позволяет использовать логин по нику, но с полноценным Auth под капотом.
const NICK_EMAIL_DOMAIN = "pulse.local";
function nickToEmail(nick) {
  return `${nick}@${NICK_EMAIL_DOMAIN}`;
}

// Базовый адрес сайта на GitHub Pages — используется для ссылок в постах
// в канал и в Telegram-уведомлениях (?date=ГГГГ-ММ-ДД).
const SITE_BASE_URL = "https://auvixda.github.io/sport/";

// Логотип/баннер, который бот прикладывает к каждому сообщению.
// Файл нужно положить в репозиторий по этому пути.
const LOGO_IMAGE_URL = `${SITE_BASE_URL}logo.png`;

// Экранирование пользовательских данных перед вставкой в HTML-подпись Telegram —
// без этого имя/телефон с символами <, >, & сломают разметку и сообщение не отправится.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// TELEGRAM — отправка сообщений напрямую из браузера.
// Токен бота и настройки берутся из settings/telegram в базе (не хардкодятся).
// Осознанно временное решение без сервера — см. ТЗ.
// ============================================================
async function fetchTelegramSettings() {
  try {
    const snap = await get(ref(db, "settings/telegram"));
    return { data: snap.val() || null, error: null };
  } catch (e) {
    console.error("Ошибка загрузки настроек Telegram:", e);
    if (e.code === "PERMISSION_DENIED" || /permission/i.test(e.message || "")) {
      return { data: null, error: "Нет доступа на чтение settings/telegram у этого аккаунта (проверьте Security Rules в Firebase)" };
    }
    return { data: null, error: "Не удалось загрузить настройки Telegram из базы" };
  }
}

function buildInlineButton(buttonText, buttonUrl) {
  if (!buttonText || !buttonUrl) return undefined;
  return { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
}

// Отправка обычного текстового сообщения (используется как фолбэк, если фото не ушло)
async function sendTelegramMessage(botToken, chatId, caption, buttonText, buttonUrl) {
  try {
    const body = {
      chat_id: chatId,
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    const markup = buildInlineButton(buttonText, buttonUrl);
    if (markup) body.reply_markup = markup;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram API (sendMessage) вернул ошибку:", data);
      return { ok: false, error: data.description || `Telegram API ошибка (код ${data.error_code || "?"})` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Ошибка запроса к Telegram API:", e);
    return { ok: false, error: "Не удалось связаться с Telegram (нет сети или блокировка)" };
  }
}

// Отправка фото с подписью и кнопкой. При неудаче (например, картинка недоступна)
// автоматически откатывается на обычное текстовое сообщение, чтобы уведомление не терялось.
async function sendTelegramPhoto(botToken, chatId, caption, buttonText, buttonUrl) {
  try {
    const body = {
      chat_id: chatId,
      photo: LOGO_IMAGE_URL,
      caption,
      parse_mode: "HTML"
    };
    const markup = buildInlineButton(buttonText, buttonUrl);
    if (markup) body.reply_markup = markup;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) return { ok: true };

    console.warn("Telegram API (sendPhoto) не удалось, пробуем текстом:", data);
    return sendTelegramMessage(botToken, chatId, caption, buttonText, buttonUrl);
  } catch (e) {
    console.error("Ошибка запроса к Telegram API (sendPhoto):", e);
    return sendTelegramMessage(botToken, chatId, caption, buttonText, buttonUrl);
  }
}

// Публикация поста в канал (используется при создании групповой тренировки)
// opts: { caption, buttonText, buttonUrl }
async function postTelegramChannelMessage(opts) {
  const { data: settings, error } = await fetchTelegramSettings();
  if (error) return { ok: false, error };
  if (!settings || !settings.botToken || !settings.channelUsername) {
    console.warn("Telegram: бот или канал ещё не настроены в settings/telegram");
    return { ok: false, error: "Бот или канал не настроены в панели администратора" };
  }
  return sendTelegramPhoto(settings.botToken, `@${settings.channelUsername}`, opts.caption, opts.buttonText, opts.buttonUrl);
}

// Личное сообщение тренеру (используется при новой заявке на тренировку)
// opts: { caption, buttonText, buttonUrl }
async function notifyTrainerTelegram(opts) {
  const { data: settings, error } = await fetchTelegramSettings();
  if (error) return { ok: false, error };
  if (!settings || !settings.botToken || !settings.trainerChatId) {
    console.warn("Telegram: бот или ID тренера ещё не настроены в settings/telegram");
    return { ok: false, error: "Бот или ID тренера не настроены в панели администратора" };
  }
  return sendTelegramPhoto(settings.botToken, settings.trainerChatId, opts.caption, opts.buttonText, opts.buttonUrl);
}

export {
  db, ref, set, push, remove, update, onValue, get,
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
  TRAINER_UID, ADMIN_UID, nickToEmail,
  SITE_BASE_URL, LOGO_IMAGE_URL, escapeHtml,
  postTelegramChannelMessage, notifyTrainerTelegram
};
