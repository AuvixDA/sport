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
  onValue
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

export {
  db, ref, set, push, remove, update, onValue,
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
  TRAINER_UID, ADMIN_UID, nickToEmail
};
