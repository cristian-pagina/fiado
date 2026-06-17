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
  where,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"

// ----------------------------------------------------------------------------
// 1) Configuración del proyecto Firebase
// ----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBioHRo8J0NirBSpcY6fxDQwqsMTttKQZU",
  authDomain: "fiados-9792d.firebaseapp.com",
  projectId: "fiados-9792d",
  storageBucket: "fiados-9792d.firebasestorage.app",
  messagingSenderId: "1002377417282",
  appId: "1:1002377417282:web:617dbb51cc7ed2c036d3db",
  measurementId: "G-T0C2E9CG0R"
};

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
  where,
  limit,
  serverTimestamp,
}
