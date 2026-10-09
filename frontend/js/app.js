const state = {
  tabActiva: "pos",
  facturasTodas: [],
  productosPVP: [],
  catalogo: [],
  catalogoMaestro: [],
  ventasPOS: [],
  flujoCaja: { historico: [], promedio_mensual: 0 },
  conteoDuplicados: {}
};

// -------------------------------------------------------------
// CONTROL DEL MENÚ LATERAL DESLIZANTE (DRAWER)
// -------------------------------------------------------------
function abrirSidebar() {
  const sidebar = document.getElementById("sidebarPrincipal");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar && backdrop) {
    sidebar.classList.remove("-translate-x-full");
    backdrop.classList.remove("hidden");
  }
}

function cerrarSidebar() {
  const sidebar = document.getElementById("sidebarPrincipal");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar && backdrop) {
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
  }
}

function navegarA(tab) {
  cambiarTab(tab);
  cerrarSidebar();
}

// -------------------------------------------------------------
// CARGA Y SINCRONIZACIÓN DE DATOS GLOBALES
// -------------------------------------------------------------
async function cargarDatosGlobales() {
  try {
    const [facturas, pvp, catalogoData, flujo, ventas] = await Promise.all([
      api.getFacturas(),
      api.getProductosPVP(),
      api.getCatalogo(),
      api.getFlujoCaja(),
      api.getVentasPOS()
    ]);

    state.facturasTodas = facturas || [];
    state.productosPVP = pvp || [];
    state.catalogo = catalogoData || [];
    state.catalogoMaestro = catalogoData || [];
    state.flujoCaja = flujo || { historico: [], promedio_mensual: 0 };
    state.ventasPOS = ventas || [];

    // Calcular facturas duplicadas
    state.conteoDuplicados = {};
    state.facturasTodas.forEach(f => {
      const num = String(f.numero_factura || "").trim().toLowerCase();
      if (num && num !== "s/n") {
        state.conteoDuplicados[num] = (state.conteoDuplicados[num] || 0) + 1;
      }
    });

    actualizarBadgesNavegacion();
    renderizarVistaActiva();
  } catch (e) {
    console.error("Error al cargar datos globales:", e);
  }
}

function actualizarBadgesNavegacion() {
  const bAud = document.getElementById("badgeNavAuditoria");
  const bPvp = document.getElementById("badgeNavPVP");
  const bCat = document.getElementById("badgeNavCatalogo");
  const bVen = document.getElementById("badgeNavVencimientos");

  if (bAud) bAud.innerText = state.facturasTodas.length;
  if (bPvp) bPvp.innerText = state.productosPVP.length;
  if (bCat) bCat.innerText = state.catalogo.length;

  if (bVen) {
    let totalLotes = 0;
    state.facturasTodas.forEach(f => {
      (f.items || []).forEach(it => {
        if (it.fecha_caducidad) totalLotes++;
      });
    });
    bVen.innerText = totalLotes;
  }
}

// -------------------------------------------------------------
// GESTOR DE RUTAS / PESTAÑAS
// -------------------------------------------------------------
function cambiarTab(tab) {
  state.tabActiva = tab;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("bg-blue-600", "text-white");
    item.classList.add("text-slate-300", "hover:bg-slate-800");
  });

  const activo = document.getElementById(`nav_${tab}`);
  if (activo) {
    activo.classList.remove("text-slate-300", "hover:bg-slate-800");
    activo.classList.add("bg-blue-600", "text-white");
  }

  const tit = document.getElementById("txtTituloVistaActual");
  const sub = document.getElementById("txtSubtituloVistaActual");

  if (tab === "pos") {
    tit.innerText = "Terminal de Ventas";
    sub.innerText = "Punto de venta directo y cobro de mostrador";
  } else if (tab === "ventas") {
    tit.innerText = "Historial de Ventas & Caja";
    sub.innerText = "Arqueo de cobros, tickets emitidos y desglose contable";
  } else if (tab === "pvp") {
    tit.innerText = "Inventario & Precios PVP";
    sub.innerText = "Control de existencias comerciales y márgenes de ganancia";
  } else if (tab === "auditoria") {
    tit.innerText = "Auditoría Fiscal & Facturas de Compra";
    sub.innerText = "Control de cuentas por pagar, cuadre contable y extracción con IA";
  } else if (tab === "catalogo") {
    tit.innerText = "Catálogo Maestro de Insumos & Costos";
    sub.innerText = "Historial comparativo de compras, análisis BI y mejores proveedores";
  } else if (tab === "vencimientos") {
    tit.innerText = "Semáforo de Lotes y Vencimientos";
    sub.innerText = "Control de caducidades, capital en riesgo y descarga en Excel";
  }

  renderizarVistaActiva();
}

// -------------------------------------------------------------
// RENDERIZADO DEL COMPONENTE ACTIVO
// -------------------------------------------------------------
function renderizarVistaActiva() {
  const contenedor = document.getElementById("contenidoPrincipal");
  if (!contenedor) return;

  if (state.tabActiva === "pos") {
    contenedor.className = "flex-1 overflow-hidden bg-slate-100 relative h-full";
    contenedor.innerHTML = ComponenteTerminalPOS.template();
    ComponenteTerminalPOS.init();
  } else if (state.tabActiva === "ventas") {
    contenedor.className = "flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 relative";
    contenedor.innerHTML = ComponenteHistorialVentas.template();
    ComponenteHistorialVentas.init();
  } else if (state.tabActiva === "pvp") {
    contenedor.className = "flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 relative";
    contenedor.innerHTML = ComponenteInventarioPVP.template();
    ComponenteInventarioPVP.init();
  } else if (state.tabActiva === "auditoria") {
    contenedor.className = "flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 relative";
    contenedor.innerHTML = ComponentePanelEstrategico.template();
    ComponentePanelEstrategico.init();
  } else if (state.tabActiva === "catalogo") {
    contenedor.className = "flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 relative";
    contenedor.innerHTML = ComponenteCatalogo.template();
    ComponenteCatalogo.init();
  } else if (state.tabActiva === "vencimientos") {
    contenedor.className = "flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 relative";
    contenedor.innerHTML = ComponenteVencimientos.template();
    ComponenteVencimientos.init();
  }
}

// -------------------------------------------------------------
// INICIALIZACIÓN
// -------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  cargarDatosGlobales();
  cambiarTab("pos");
});