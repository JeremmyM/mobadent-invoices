const ComponenteCatalogoMovil = {
  filtroTexto: "",
  filtroCategoria: "todas",

  template() {
    return `
      <div class="space-y-4">
        <!-- Encabezado Catálogo -->
        <div class="bg-blue-600 text-white p-5 rounded-3xl shadow-sm space-y-1">
          <div class="flex justify-between items-center">
            <h2 class="text-base font-black tracking-tight">Catálogo Maestro</h2>
            <span id="badgeCatMovilTotal" class="text-[11px] font-bold bg-white/20 px-3 py-0.5 rounded-full">0</span>
          </div>
          <p class="text-xs text-blue-100">Precios mínimos, dispersión y compras históricas.</p>
        </div>

        <!-- Buscador y Categorías -->
        <div class="space-y-2">
          <div class="relative">
            <input type="text" id="filtroTxtCatMovil" oninput="ComponenteCatalogoMovil.filtrarTexto(this.value)" placeholder="Buscar insumo o proveedor..." 
                   class="w-full bg-white border border-slate-200/80 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs font-medium placeholder-slate-400">
            <span class="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
          </div>

          <select id="selectCatMovil" onchange="ComponenteCatalogoMovil.filtrarCategoria(this.value)" class="w-full bg-white border border-slate-200/80 text-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 shadow-xs">
            <option value="todas">Todas las categorías</option>
            <option value="General">General</option>
            <option value="Restauración & Estética">Restauración & Estética</option>
            <option value="Endodoncia">Endodoncia</option>
            <option value="Ortodoncia">Ortodoncia</option>
            <option value="Periodoncia & Profilaxis">Periodoncia & Profilaxis</option>
            <option value="Impresión & Modelos">Impresión & Modelos</option>
            <option value="Prótesis & Laboratorio">Prótesis & Laboratorio</option>
            <option value="Instrumental & Fresas">Instrumental & Fresas</option>
            <option value="Bioseguridad & Esterilización">Bioseguridad & Esterilización</option>
            <option value="Equipos & Repuestos">Equipos & Repuestos</option>
          </select>
        </div>

        <!-- Lista de Productos -->
        <div id="contenedorTarjetasCatalogo" class="space-y-3"></div>
      </div>
    `;
  },

  init() {
    this.renderTarjetas();
  },

  filtrarTexto(val) {
    this.filtroTexto = (val || "").toLowerCase().trim();
    this.renderTarjetas();
  },

  filtrarCategoria(val) {
    this.filtroCategoria = val;
    this.renderTarjetas();
  },

  renderTarjetas() {
    const cont = document.getElementById("contenedorTarjetasCatalogo");
    if (!cont) return;
    cont.innerHTML = "";

    const filtrados = stateMovil.catalogo.filter(p => {
      const matchT = !this.filtroTexto || 
        p.producto.toLowerCase().includes(this.filtroTexto) || 
        (p.mejor_proveedor && p.mejor_proveedor.toLowerCase().includes(this.filtroTexto));
      const matchC = (this.filtroCategoria === "todas") || (p.categoria === this.filtroCategoria);
      return matchT && matchC;
    });

    const badge = document.getElementById("badgeCatMovilTotal");
    if (badge) badge.innerText = `${filtrados.length} productos`;

    if (filtrados.length === 0) {
      cont.innerHTML = `<div class="bg-white p-6 rounded-3xl border border-slate-200/80 text-center text-xs text-slate-400 font-medium">No se encontraron productos.</div>`;
      return;
    }

    filtrados.forEach((p, idx) => {
      const pMin = parseFloat(p.precio_min || 0);
      const pMax = parseFloat(p.precio_max || 0);
      const ahorro = pMax > pMin ? (pMax - pMin).toFixed(2) : 0;
      const historial = p.historial || [];

      const opcionesCat = CATEGORIAS_SISTEMA.map(c => 
        `<option value="${c}" ${p.categoria === c ? 'selected' : ''}>${c}</option>`
      ).join('');

      const card = document.createElement("div");
      card.className = "bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3";
      card.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1">
            <h3 class="font-bold text-slate-900 text-xs leading-snug">${p.producto}</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">Mejor proveedor: <strong class="text-emerald-700">${p.mejor_proveedor || 'N/A'}</strong></p>
          </div>
          ${ahorro > 0 ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[9px]">Ahorro: $${ahorro}</span>` : ''}
        </div>

        <!-- Selector de Categoría Rápido -->
        <div>
          <select onchange="ComponenteCatalogoMovil.cambiarCategoria('${encodeURIComponent(p.producto)}', this.value)" 
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-700">
            ${opcionesCat}
          </select>
        </div>

        <!-- Comparativa Precios -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-2">
            <span class="text-[8px] uppercase font-bold text-emerald-700 block">Mínimo</span>
            <span class="text-xs font-black text-emerald-800 font-mono">$${pMin.toFixed(2)}</span>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <span class="text-[8px] uppercase font-bold text-slate-400 block">Promedio</span>
            <span class="text-xs font-black text-blue-700 font-mono">$${parseFloat(p.precio_promedio || 0).toFixed(2)}</span>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <span class="text-[8px] uppercase font-bold text-slate-400 block">Máximo</span>
            <span class="text-xs font-black text-slate-800 font-mono">$${pMax.toFixed(2)}</span>
          </div>
        </div>

        <!-- Botón Desplegable Histórico -->
        <div class="pt-1">
          <button onclick="ComponenteCatalogoMovil.toggleHistorial(${idx})" class="w-full py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1">
            📋 Historial de Compras (${historial.length}) ▼
          </button>
        </div>

        <!-- Acordeón Oculto -->
        <div id="historial-cat-movil-${idx}" class="hidden pt-2 border-t border-slate-100 space-y-1.5">
          ${historial.map(h => `
            <div class="p-2 bg-slate-50 rounded-xl border border-slate-200/70 text-[10px] flex justify-between items-center">
              <div>
                <span class="font-bold text-slate-800 block">${h.proveedor}</span>
                <span class="text-slate-400 font-mono">Fac #${h.factura} • ${formatearFechaLatam(h.fecha)}</span>               </div>               <div class="text-right">                 <span class="font-black font-mono text-slate-900 block">$${parseFloat(h.precio || 0).toFixed(2)}</span>
                <span class="text-slate-400">${h.cantidad} ud(s)</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      cont.appendChild(card);
    });
  },

  toggleHistorial(idx) {
    const el = document.getElementById(`historial-cat-movil-${idx}`);
    if (el) el.classList.toggle("hidden");
  },

  async cambiarCategoria(prodEncoded, nuevaCat) {
    const prod = decodeURIComponent(prodEncoded);
    try {
      await apiMovil.cambiarCategoria(prod, nuevaCat);
      const item = stateMovil.catalogo.find(p => p.producto === prod);
      if (item) item.categoria = nuevaCat;
      alert(`Categoría de "${prod}" actualizada.`);
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
  }
};