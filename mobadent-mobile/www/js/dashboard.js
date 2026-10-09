const stateMovil = {
  facturas: [],
  catalogo: [],
  conteoDuplicados: {},
  vistaActiva: "facturas"
};

const routerMovil = {
  navegar(vista) {
    stateMovil.vistaActiva = vista;

    ["facturas", "vencimientos", "catalogo"].forEach(v => {
      const btn = document.getElementById(`btnNav${v.charAt(0).toUpperCase() + v.slice(1)}`);
      if (btn) {
        btn.className = (v === vista)
          ? "flex flex-col items-center text-blue-600 transition cursor-pointer font-bold"
          : "flex flex-col items-center text-slate-400 active:text-slate-600 transition cursor-pointer";
      }
    });

    const container = document.getElementById("mainContainerMobile");
    if (!container) return;

    try {
      if (vista === "facturas") {
        container.innerHTML = ComponentePanelFacturas.template();
        ComponentePanelFacturas.init();
      } else if (vista === "vencimientos") {
        container.innerHTML = ComponenteVencimientosMovil.template();
        ComponenteVencimientosMovil.init();
      } else if (vista === "catalogo") {
        container.innerHTML = ComponenteCatalogoMovil.template();
        ComponenteCatalogoMovil.init();
      }
    } catch (err) {
      console.error("Error al montar vista móvil:", err);
      container.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold">Error: ${err.message}</div>`;
    }
  }
};

async function cargarDatosGlobalesMovil() {
  const badge = document.getElementById("badgeEstadoConexion");
  if (badge) {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shadow-2xs";
    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Conectando...';
  }

  try {
    const [facturas, catalogo] = await Promise.all([
      apiMovil.getFacturas(),
      apiMovil.getCatalogo()
    ]);

    stateMovil.facturas = facturas;
    stateMovil.catalogo = catalogo;

    // Calcular duplicados
    stateMovil.conteoDuplicados = {};
    facturas.forEach(f => {
      const num = String(f.numero_factura || "").trim().toLowerCase();
      if (num && num !== "s/n" && num !== "s/f") {
        stateMovil.conteoDuplicados[num] = (stateMovil.conteoDuplicados[num] || 0) + 1;
      }
    });

    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shadow-2xs";
      badge.innerHTML = '● Conectado a Neon';
    }

    routerMovil.navegar(stateMovil.vistaActiva);

  } catch (err) {
    console.error("Error de conexión:", err);
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 shadow-2xs";
      badge.innerHTML = '✕ Error Neon';
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  cargarDatosGlobalesMovil();
  window.addEventListener("mobadent_desbloqueado", cargarDatosGlobalesMovil);
});