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

// ============================================================
// TELEGRAM — отправка сообщений напрямую из браузера.
// Токен бота и настройки берутся из settings/telegram в базе (не хардкодятся).
// Осознанно временное решение без сервера — см. ТЗ.
// ============================================================
async function fetchTelegramSettings() {
  try {
    const snap = await get(ref(db, "settings/telegram"));
    return snap.val() || null;
  } catch (e) {
    console.error("Ошибка загрузки настроек Telegram:", e);
    return null;
  }
}

// Возвращает { ok: true } либо { ok: false, error: "человекочитаемая причина" }
async function sendTelegramMessage(botToken, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram API вернул ошибку:", data);
      return { ok: false, error: data.description || `Telegram API ошибка (код ${data.error_code || "?"})` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Ошибка запроса к Telegram API:", e);
    return { ok: false, error: "Не удалось связаться с Telegram (нет сети или блокировка)" };
  }
}

// Путь к промо-картинке, которая уходит в канал вместе с постом (баннер "ТРЕНИРОВКА ЖДЁТ ТЕБЯ").
// Файл лежит рядом с html-страницами сайта — см. assets/promo.png.
const CHANNEL_PHOTO_PATH = "promo.png";

// Отправка фото с подписью в Telegram (используется для постов в канал).
// Картинка берётся с самого сайта и заливается в Telegram как файл (multipart),
// это не зависит от того, успел ли Telegram закэшировать/дотянуться до GitHub Pages по URL.
// Возвращает { ok: true } либо { ok: false, error: "человекочитаемая причина" }
async function sendTelegramPhoto(botToken, chatId, caption) {
  try {
    const imgRes = await fetch(CHANNEL_PHOTO_PATH);
    if (!imgRes.ok) {
      throw new Error(`Не удалось загрузить ${CHANNEL_PHOTO_PATH} (код ${imgRes.status})`);
    }
    const blob = await imgRes.blob();

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("photo", blob, "promo.png");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram API (sendPhoto) вернул ошибку:", data);
      return { ok: false, error: data.description || `Telegram API ошибка (код ${data.error_code || "?"})` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Ошибка отправки фото в Telegram:", e);
    return { ok: false, error: "Не удалось отправить фото в Telegram (нет сети, блокировка или файл не найден на сайте)" };
  }
}

// Публикация поста в канал (используется при создании групповой тренировки и в тесте связи).
// Идёт с фото-баннером + подписью (caption у фото ограничен Telegram 1024 символами,
// это с запасом покрывает текущие тексты постов).
async function postTelegramChannelMessage(text) {
  const settings = await fetchTelegramSettings();
  if (!settings || !settings.botToken || !settings.channelUsername) {
    console.warn("Telegram: бот или канал ещё не настроены в settings/telegram");
    return { ok: false, error: "Бот или канал не настроены в панели администратора" };
  }
  return sendTelegramPhoto(settings.botToken, `@${settings.channelUsername}`, text);
}

// Личное сообщение тренеру (используется при новой заявке на тренировку)
async function notifyTrainerTelegram(text) {
  const settings = await fetchTelegramSettings();
  if (!settings || !settings.botToken || !settings.trainerChatId) {
    console.warn("Telegram: бот или ID тренера ещё не настроены в settings/telegram");
    return { ok: false, error: "Бот или ID тренера не настроены в панели администратора" };
  }
  return sendTelegramMessage(settings.botToken, settings.trainerChatId, text);
}

export {
  db, ref, set, push, remove, update, onValue, get,
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
  TRAINER_UID, ADMIN_UID, nickToEmail,
  SITE_BASE_URL, postTelegramChannelMessage, notifyTrainerTelegram
};