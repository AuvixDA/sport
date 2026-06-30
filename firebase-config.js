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

// ВАЖНО: для полноценной работы нужен полный firebaseConfig
// (apiKey, authDomain, projectId и т.д.) из настроек проекта Firebase.
// Сейчас указан только databaseURL — этого достаточно для Realtime Database
// без авторизации Firebase Auth, но если появятся ошибки подключения,
// нужно будет вписать остальные поля из консоли Firebase (Project settings -> General).
const firebaseConfig = {
  databaseURL: "https://sport-9c35b-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, push, remove, update, onValue };
