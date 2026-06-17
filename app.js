// app.js
// ============================================================================
// Lógica principal del Cuaderno de Fiados.
// - Login local (usuario/contraseña en JS) con persistencia en localStorage.
// - CRUD básico sobre Firestore (clientes y movimientos).
// - Operaciones: cargo, abono y pago total, con confirmación por modal.
// - Dashboard e historial.
// ============================================================================

import {
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
} from "./firebase.js"

// ----------------------------------------------------------------------------
// CONFIGURACIÓN DE CREDENCIALES LOCALES
// ----------------------------------------------------------------------------
const CREDENCIALES = {
  usuario: "cristian",
  password: "cristian123",
}

const STORAGE_KEY = "fiados_sesion"

// ----------------------------------------------------------------------------
// ESTADO EN MEMORIA
// ----------------------------------------------------------------------------
const estado = {
  usuario: null, // nombre de usuario logueado
  clienteActual: null, // objeto cliente cargado en la ficha
}

// ============================================================================
// UTILIDADES REUTILIZABLES
// ============================================================================

/** Atajo para document.getElementById */
const $ = (id) => document.getElementById(id)

/** Muestra u oculta el loader global */
function mostrarLoader(mostrar) {
  $("loader").classList.toggle("hidden", !mostrar)
}

/** Muestra un mensaje tipo toast (éxito o error) */
function notificar(mensaje, tipo = "success") {
  const cont = $("toast-container")
  const toast = document.createElement("div")
  toast.className = `toast toast-${tipo}`
  toast.textContent = mensaje
  cont.appendChild(toast)
  // Se elimina automáticamente luego de 3 segundos
  setTimeout(() => toast.remove(), 3000)
}

/** Formatea un número como pesos chilenos: 12000 -> "$12.000" */
function formatearCLP(monto) {
  const valor = Number(monto) || 0
  return valor.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  })
}

/**
 * Limpia y normaliza un RUT: quita puntos, guiones y espacios,
 * y deja el dígito verificador en mayúscula. Ej: "12.345.678-5" -> "123456785"
 */
function limpiarRut(rut) {
  return rut.replace(/[.\-\s]/g, "").toUpperCase()
}

/**
 * Valida un RUT chileno usando el algoritmo Módulo 11.
 * Acepta dígito verificador 0-9 o K.
 */
function validarRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return false

  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)

  if (!/^\d+$/.test(cuerpo)) return false

  // Cálculo del dígito verificador
  let suma = 0
  let multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }
  const resto = 11 - (suma % 11)
  const dvEsperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto)

  return dv === dvEsperado
}

/** Formatea un RUT para mostrarlo: "123456785" -> "12.345.678-5" */
function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${cuerpoFmt}-${dv}`
}

/** Convierte un Timestamp de Firestore (o Date) a texto legible */
function formatearFecha(ts) {
  if (!ts) return "—"
  const fecha = ts.toDate ? ts.toDate() : new Date(ts)
  return fecha.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ============================================================================
// MODAL DE CONFIRMACIÓN REUTILIZABLE
// ============================================================================
// Devuelve una promesa que resuelve con:
//   - el monto ingresado (number) si se confirma y pide monto
//   - true si se confirma sin pedir monto
//   - null si se cancela
function abrirModal({ titulo, mensaje, pedirMonto = false }) {
  return new Promise((resolve) => {
    const overlay = $("modal")
    const inputWrap = $("modal-input-wrap")
    const input = $("modal-input")

    $("modal-title").textContent = titulo
    $("modal-message").textContent = mensaje
    inputWrap.classList.toggle("hidden", !pedirMonto)
    input.value = ""

    overlay.classList.remove("hidden")
    if (pedirMonto) input.focus()

    // Limpieza de listeners para evitar duplicados
    const cerrar = (resultado) => {
      overlay.classList.add("hidden")
      $("modal-confirm").onclick = null
      $("modal-cancel").onclick = null
      resolve(resultado)
    }

    $("modal-cancel").onclick = () => cerrar(null)

    $("modal-confirm").onclick = () => {
      if (pedirMonto) {
        const monto = Number(input.value)
        if (!monto || monto <= 0) {
          notificar("Ingresa un monto válido mayor a 0", "error")
          return
        }
        cerrar(monto)
      } else {
        cerrar(true)
      }
    }
  })
}

// ============================================================================
// AUTENTICACIÓN LOCAL
// ============================================================================

/** Revisa si hay una sesión guardada al iniciar la app */
function comprobarSesion() {
  const guardado = localStorage.getItem(STORAGE_KEY)
  if (guardado) {
    estado.usuario = guardado
    entrarApp()
  }
}

/** Maneja el envío del formulario de login */
function manejarLogin(e) {
  e.preventDefault()
  const usuario = $("login-user").value.trim()
  const pass = $("login-pass").value

  if (usuario === CREDENCIALES.usuario && pass === CREDENCIALES.password) {
    estado.usuario = usuario
    localStorage.setItem(STORAGE_KEY, usuario)
    entrarApp()
    notificar("Bienvenido, " + usuario)
  } else {
    notificar("Usuario o contraseña incorrectos", "error")
  }
}

/** Cierra la sesión */
function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY)
  estado.usuario = null
  estado.clienteActual = null
  $("app").classList.add("hidden")
  $("login-screen").classList.remove("hidden")
  $("login-form").reset()
}

/** Muestra la app y oculta el login */
function entrarApp() {
  $("login-screen").classList.add("hidden")
  $("app").classList.remove("hidden")
  $("current-user").textContent = "👤 " + estado.usuario
  cambiarVista("inicio")
}

// ============================================================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================================================
function cambiarVista(vista) {
  // Tabs activos
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === vista)
  })
  // Vistas visibles
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"))
  $("view-" + vista).classList.remove("hidden")

  // Carga de datos según la vista
  if (vista === "dashboard") cargarDashboard()
  if (vista === "historial") cargarHistorial()
}

// ============================================================================
// CLIENTES — BUSCAR Y REGISTRAR
// ============================================================================

/** Busca un cliente por RUT en Firestore */
async function buscarCliente() {
  const entrada = $("search-rut").value.trim()

  // Validación de RUT antes de consultar
  if (!validarRut(entrada)) {
    notificar("RUT inválido. Verifica e intenta nuevamente.", "error")
    return
  }

  const rut = limpiarRut(entrada)

  // Reiniciamos tarjetas
  $("client-card").classList.add("hidden")
  cerrarModalNuevoCliente()
  estado.clienteActual = null

  mostrarLoader(true)
  try {
    const ref = doc(db, "clientes", rut)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      // Cliente existente -> mostrar ficha
      estado.clienteActual = { id: rut, ...snap.data() }
      mostrarFichaCliente()
    } else {
      // No existe -> abrir ventana para registrar nuevo fiador
      abrirModalNuevoCliente(rut)
      notificar("Cliente no encontrado. Agrega un nuevo fiador.", "error")
    }
  } catch (err) {
    console.log("[v0] Error al buscar cliente:", err.message)
    notificar("Error al consultar la base de datos", "error")
  } finally {
    mostrarLoader(false)
  }
}

/** Rellena y muestra la ficha del cliente actual */
function mostrarFichaCliente() {
  const c = estado.clienteActual
  $("client-name").textContent = `${c.nombre} ${c.apellido}`
  $("client-rut").textContent = formatearRut(c.rut)
  $("client-debt").textContent = formatearCLP(c.deuda)
  $("client-card").classList.remove("hidden")
}

/** Abre el modal de nuevo fiador con el RUT buscado precargado */
function abrirModalNuevoCliente(rut) {
  $("new-client-form").reset()
  $("nc-rut").value = formatearRut(rut)
  $("new-client-modal").classList.remove("hidden")
  $("nc-nombre").focus()
}

/** Cierra el modal de nuevo fiador */
function cerrarModalNuevoCliente() {
  $("new-client-modal").classList.add("hidden")
}

/** Registra un nuevo cliente */
async function registrarCliente(e) {
  e.preventDefault()
  const rut = limpiarRut($("nc-rut").value)
  const nombre = $("nc-nombre").value.trim()
  const apellido = $("nc-apellido").value.trim()

  if (!nombre || !apellido) {
    notificar("Nombre y apellido son obligatorios", "error")
    return
  }

  mostrarLoader(true)
  try {
    const nuevoCliente = {
      rut,
      nombre,
      apellido,
      deuda: 0,
      fechaCreacion: serverTimestamp(),
    }
    // Usamos el RUT como ID del documento para búsquedas directas
    await setDoc(doc(db, "clientes", rut), nuevoCliente)

    notificar("Fiador registrado correctamente")
    estado.clienteActual = { id: rut, ...nuevoCliente, deuda: 0 }

    cerrarModalNuevoCliente()
    mostrarFichaCliente()
  } catch (err) {
    console.log("[v0] Error al registrar cliente:", err.message)
    notificar("No se pudo registrar el fiador", "error")
  } finally {
    mostrarLoader(false)
  }
}

// ============================================================================
// OPERACIONES — CARGO, ABONO, PAGO TOTAL
// ============================================================================
async function ejecutarOperacion(tipoOp) {
  const c = estado.clienteActual
  if (!c) {
    notificar("Primero selecciona un cliente", "error")
    return
  }

  const deudaActual = Number(c.deuda) || 0
  let monto = 0
  let tipoMovimiento = ""
  let deudaNueva = 0

  // Configuramos el modal según la operación
  if (tipoOp === "cargo") {
    monto = await abrirModal({
      titulo: "Agregar deuda",
      mensaje: `Cliente: ${c.nombre} ${c.apellido}. Ingresa el monto a agregar.`,
      pedirMonto: true,
    })
    if (monto === null) return
    tipoMovimiento = "Cargo"
    deudaNueva = deudaActual + monto
  } else if (tipoOp === "abono") {
    if (deudaActual <= 0) {
      notificar("El cliente no tiene deuda pendiente", "error")
      return
    }
    monto = await abrirModal({
      titulo: "Abonar a la deuda",
      mensaje: `Deuda actual: ${formatearCLP(deudaActual)}. Ingresa el monto a abonar.`,
      pedirMonto: true,
    })
    if (monto === null) return
    // No permitir que la deuda quede negativa
    if (monto > deudaActual) {
      notificar("El abono no puede superar la deuda actual", "error")
      return
    }
    tipoMovimiento = "Abono"
    deudaNueva = deudaActual - monto
  } else if (tipoOp === "pago") {
    if (deudaActual <= 0) {
      notificar("El cliente no tiene deuda pendiente", "error")
      return
    }
    const ok = await abrirModal({
      titulo: "Saldar deuda completa",
      mensaje: `¿Confirmas saldar la deuda total de ${formatearCLP(deudaActual)}?`,
      pedirMonto: false,
    })
    if (!ok) return
    monto = deudaActual
    tipoMovimiento = "Pago total"
    deudaNueva = 0
  }

  // Guardamos en Firestore
  mostrarLoader(true)
  try {
    await updateDoc(doc(db, "clientes", c.id), { deuda: deudaNueva })

    await registrarMovimiento({
      rut: c.rut,
      nombre: `${c.nombre} ${c.apellido}`,
      tipo: tipoMovimiento,
      monto,
      deudaAnterior: deudaActual,
      deudaNueva,
    })

    // Actualizamos estado y UI
    estado.clienteActual.deuda = deudaNueva
    $("client-debt").textContent = formatearCLP(deudaNueva)
    notificar(`${tipoMovimiento} registrado: ${formatearCLP(monto)}`)
  } catch (err) {
    console.log("[v0] Error en la operación:", err.message)
    notificar("No se pudo completar la operación", "error")
  } finally {
    mostrarLoader(false)
  }
}

/** Guarda un movimiento en la colección "movimientos" */
async function registrarMovimiento(datos) {
  await addDoc(collection(db, "movimientos"), {
    ...datos,
    usuario: estado.usuario,
    fecha: serverTimestamp(),
  })
}

// ============================================================================
// DASHBOARD
// ============================================================================
async function cargarDashboard() {
  mostrarLoader(true)
  try {
    const clientesSnap = await getDocs(collection(db, "clientes"))
    const movimientosSnap = await getDocs(collection(db, "movimientos"))

    let totalDeuda = 0
    clientesSnap.forEach((d) => {
      totalDeuda += Number(d.data().deuda) || 0
    })

    $("stat-clientes").textContent = clientesSnap.size
    $("stat-deuda").textContent = formatearCLP(totalDeuda)
    $("stat-movimientos").textContent = movimientosSnap.size
  } catch (err) {
    console.log("[v0] Error al cargar dashboard:", err.message)
    notificar("No se pudo cargar el dashboard", "error")
  } finally {
    mostrarLoader(false)
  }
}

// ============================================================================
// HISTORIAL
// ============================================================================
async function cargarHistorial() {
  const lista = $("history-list")
  mostrarLoader(true)
  try {
    // Ordenado del más reciente al más antiguo
    const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"))
    const snap = await getDocs(q)

    if (snap.empty) {
      lista.innerHTML = '<p class="muted">Sin movimientos por mostrar.</p>'
      return
    }

    lista.innerHTML = ""
    snap.forEach((d) => {
      const m = d.data()
      const claseTipo =
        m.tipo === "Abono"
          ? "tipo-abono"
          : m.tipo === "Pago total"
            ? "tipo-pago"
            : "tipo-cargo"

      const item = document.createElement("div")
      item.className = `history-item ${claseTipo}`
      item.innerHTML = `
        <div class="hi-top">
          <span class="hi-tipo">${m.tipo}</span>
          <span class="hi-monto">${formatearCLP(m.monto)}</span>
        </div>
        <div class="hi-meta">
          ${m.nombre} · ${formatearRut(m.rut)}<br />
          Deuda: ${formatearCLP(m.deudaAnterior)} → ${formatearCLP(m.deudaNueva)}<br />
          ${formatearFecha(m.fecha)} · por ${m.usuario || "—"}
        </div>
      `
      lista.appendChild(item)
    })
  } catch (err) {
    console.log("[v0] Error al cargar historial:", err.message)
    notificar("No se pudo cargar el historial", "error")
  } finally {
    mostrarLoader(false)
  }
}

// ============================================================================
// REGISTRO DE EVENTOS (inicialización)
// ============================================================================
function init() {
  // Login / logout
  $("login-form").addEventListener("submit", manejarLogin)
  $("logout-btn").addEventListener("click", cerrarSesion)

  // Navegación
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => cambiarVista(tab.dataset.view))
  })

  // Buscar / registrar cliente
  $("search-btn").addEventListener("click", buscarCliente)
  $("search-rut").addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarCliente()
  })
  $("new-client-form").addEventListener("submit", registrarCliente)
  $("nc-cancel").addEventListener("click", cerrarModalNuevoCliente)

  // Operaciones (delegación sobre los botones data-op)
  document.querySelectorAll("[data-op]").forEach((btn) => {
    btn.addEventListener("click", () => ejecutarOperacion(btn.dataset.op))
  })

  // Botones de actualización
  $("refresh-dashboard").addEventListener("click", cargarDashboard)
  $("refresh-history").addEventListener("click", cargarHistorial)

  // ¿Hay sesión activa?
  comprobarSesion()
}

document.addEventListener("DOMContentLoaded", init)
