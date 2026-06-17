// firebase.js
// ============================================================================
// Configuración e inicialización de Firebase (Firestore).
// Se usa el SDK modular de Firebase v10 cargado desde el CDN oficial.
//
// IMPORTANTE:
//   Reemplaza el objeto "firebaseConfig" con las credenciales de TU proyecto.
//   Las obtienes en: Consola de Firebase -> Configuración del proyecto ->
//   "Tus apps" -> Configuración del SDK -> Config.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"

// ----------------------------------------------------------------------------
// 1) Configuración del proyecto Firebase
// ----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
}

// ----------------------------------------------------------------------------
// 2) Inicialización
// ----------------------------------------------------------------------------
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ----------------------------------------------------------------------------
// 3) Exportamos lo necesario para usarlo desde app.js
//    Reexportamos también las funciones de Firestore para centralizar imports.
// ----------------------------------------------------------------------------
export {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
}
