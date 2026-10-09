const state = {
  facturasTodas: [],
  catalogo: [],
  flujoCaja: { historico: [], promedio_mensual: 0 },
  conteoDuplicados: {},
  productosPVP: [],
  vistaActiva: "panel"
};

const router = {
  navegar(vista) {
    state.vistaActiva = vista;
    
    // 1. Actualizar clases de botones de forma segura (sin romperse si uno no existe)
    ["panel", "vencimientos", "catalogo", "pvp"].forEach(v => {
      const btn = document.getElementById(`nav-${v}`);
      if (btn) {
        if (v === vista) {
          let color = 'border-blue-600 text-blue-600';
          if (v === 'vencimientos') color = 'border-rose-600 text-rose-600';
          if (v === 'pvp') color = 'border-emerald-600 text-emerald-600';
          btn.className = `pb-3 border-b-2 ${color} flex items-center gap-2 cursor-pointer font-bold`;
        } else {
          btn.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 cursor-pointer font-medium";
        }
      }
    });

    // 2. Renderizar componentes de forma protegida
    const container = document.getElementById("mainContainer");
    if (!container) return;

    try {
      if (vista === "panel") {
        if (typeof ComponentePanelEstrategico !== "undefined") {
          container.innerHTML = ComponentePanelEstrategico.template();
          ComponentePanelEstrategico.init();
        } else {
          container.innerHTML = `<div class="p-8 text-center text-slate-400">Cargando Panel Estratégico...</div>`;
        }
      } else if (vista === "vencimientos") {
        if (typeof ComponenteVencimientos !== "undefined") {
          container.innerHTML = ComponenteVencimientos.template();
          ComponenteVencimientos.init();
        } else {
          container.innerHTML = `<div class="p-8 text-center text-slate-400">Cargando Vencimientos...</div>`;
        }
      } else if (vista === "catalogo") {
        if (typeof ComponenteCatalogo !== "undefined") {
          container.innerHTML = ComponenteCatalogo.template();
          ComponenteCatalogo.init();
        } else {
          container.innerHTML = `<div class="p-8 text-center text-slate-400">Cargando Insumos y Costos...</div>`;
        }
      } else if (vista === "pvp") {
        if (typeof ComponenteInventarioPVP !== "undefined") {
          container.innerHTML = ComponenteInventarioPVP.template();
          ComponenteInventarioPVP.init();
        } else {
          container.innerHTML = `<div class="p-8 text-center text-slate-400">Cargando Inventario PVP...</div>`;
        }
      }
    } catch (err) {
      console.error(`Error renderizando vista ${vista}:`, err);
      container.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">Error al cargar la pestaña: ${err.message}</div>`;
    }
  }
};

async function cargarDatosGlobales() {
  try {
    // Carga protegida e individual para evitar que un fallo en un endpoint tire toda la app
    const [facturas, flujo, cat, pvp] = await Promise.all([
      api.getFacturas().catch(() => []),
      api.getFlujoCaja().catch(() => ({ historico: [], promedio_mensual: 0 })),
      api.getCatalogo().catch(() => []),
      (api.getProductosPVP ? api.getProductosPVP() : Promise.resolve([])).catch(() => [])
    ]);

    state.facturasTodas = Array.isArray(facturas) ? facturas : [];
    state.flujoCaja = flujo || { historico: [], promedio_mensual: 0 };
    state.catalogo = Array.isArray(cat) ? cat : (cat.productos || []);
    state.productosPVP = Array.isArray(pvp) ? pvp : [];

    // Conteo de facturas duplicadas y caducidades
    state.conteoDuplicados = {};
    let totalCercanos = 0;
    const hoyTime = new Date(new Date().toISOString().slice(0, 10)).getTime();

    state.facturasTodas.forEach(f => {
      const num = String(f.numero_factura || "").trim().toLowerCase();
      if (num && num !== "s/n" && num !== "s/f") {
        state.conteoDuplicados[num] = (state.conteoDuplicados[num] || 0) + 1;
      }

      (f.items || []).forEach(it => {
        const expIso = parsearFechaISO(it.fecha_caducidad);
        if (expIso) {
          const dias = Math.ceil((new Date(expIso).getTime() - hoyTime) / (1000 * 60 * 60 * 24));
          if (dias <= 90) totalCercanos++;
        }
      });
    });

    // Actualizar badges numéricos de forma segura
    const bVenc = document.getElementById("badgeNavVencimientos");
    if (bVenc) bVenc.innerText = totalCercanos;

    const bCat = document.getElementById("badgeNavCatalogo");
    if (bCat) bCat.innerText = state.catalogo.length;

    const bPvp = document.getElementById("badgeNavPVP");
    if (bPvp) bPvp.innerText = state.productosPVP.length;

    // Iniciar en la pestaña principal
    router.navegar("panel");

  } catch (err) {
    console.error("Error global en inicialización:", err);
    router.navegar("panel");
  }
}

window.addEventListener("DOMContentLoaded", cargarDatosGlobales);