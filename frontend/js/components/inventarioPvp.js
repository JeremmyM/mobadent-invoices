const ComponenteInventarioPVP = {
  productos: [],
  filtroTexto: "",
  filtroCategoria: "todas",
  filtroStockEstado: "todos",

  template() {
    return `
      <div class="space-y-6">

        <!-- 1. KPIS FINANCIEROS COMERCIALES -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Valor en Mostrador (PVP)
              </span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">Venta Total</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiValorTotalPVP" class="text-3xl font-black text-emerald-700 tracking-tight">$0.00</span>
            </div>
            <div class="mt-2 pt-2 border-t border-emerald-100/80 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Margen potencial:</span>
              <span class="font-mono font-black text-emerald-800" id="kpiMargenTotalPVP">+0%</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span> Inversión en Stock
              </span>
              <span class="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">Costo Base</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiCostoTotalPVP" class="text-3xl font-black text-blue-700 tracking-tight">$0.00</span>
            </div>
            <div class="mt-2 pt-2 border-t border-blue-100/80 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Catálogo activo:</span>
              <span class="font-mono font-black text-blue-800" id="kpiTotalProdsPVP">0 productos</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span> Stock Crítico (≤ 3 uds)
              </span>
              <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">Por Agotarse</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiStockBajoPVP" class="text-3xl font-black text-amber-700 tracking-tight">0</span>
              <span class="text-xs text-amber-500 font-semibold">artículos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-amber-100/80 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Acción requerida:</span>
              <span class="font-mono font-bold text-amber-800">Pedir a proveedor</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Agotados (0 uds)
              </span>
              <span class="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">Sin Existencia</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiAgotadosPVP" class="text-3xl font-black text-rose-700 tracking-tight">0</span>
              <span class="text-xs text-rose-500 font-semibold">artículos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-rose-100/80 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Ventas perdidas:</span>
              <span class="font-mono font-black text-rose-700">Reabastecer</span>
            </div>
          </div>
        </div>

        <!-- 2. TERMINAL DE DESPACHO RÁPIDO (CÓDIGO DE BARRAS) -->
        <div class="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-3">
            <span class="text-2xl">⚡</span>
            <div>
              <h3 class="text-xs font-black uppercase tracking-wider text-slate-200">Terminal de Despacho Rápido</h3>
              <p class="text-[11px] text-slate-400">Escanea con la pistola USB o escribe el código/nombre y presiona Enter para descontar (-1)</p>
            </div>
          </div>
          <div class="relative w-full sm:w-80">
            <input type="text" id="inputEscaneoRapido" onkeydown="ComponenteInventarioPVP.procesarEscaneo(event)" 
                   placeholder="Escanear código de barras..." 
                   class="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          </div>
        </div>

        <!-- 3. CONTENEDOR PRINCIPAL, ACCIONES Y TABLA -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-800">Inventario Comercial & PVP (Aronium Sync)</h2>
                <span id="badgeTotalItemsPVP" class="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                  0 productos
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Precios de venta al público y stock físico en mostrador sincronizados con compras</p>
            </div>

            <div class="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
              <button onclick="ComponenteInventarioPVP.purgarAgotados()" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer">
                🧹 Limpiar Agotados (0 uds)
              </button>
              <button onclick="ComponenteInventarioPVP.abrirImportadorAronium()" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer">
                📥 Sincronizar Aronium (CSV)
              </button>
              <button onclick="ComponenteInventarioPVP.abrirModalNuevo()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer">
                + Crear Producto
              </button>
              <input type="file" id="inputCsvAronium" accept=".csv" class="hidden" onchange="ComponenteInventarioPVP.procesarArchivoCsv(event)">
            </div>
          </div>

          <!-- FILTROS -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div class="relative">
              <input type="text" id="filtroTextoPVP" oninput="ComponenteInventarioPVP.filtrar(this.value)" placeholder="Buscar por código de barras o producto..." 
                     class="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium">
              <span class="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
            </div>

            <div>
              <select id="filtroStockPVP" onchange="ComponenteInventarioPVP.filtrarEstadoStock(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 font-bold focus:ring-2 focus:ring-blue-500">
                <option value="todos" selected>Todos los niveles de stock</option>
                <option value="ok">🟢 Stock Normal (> 3 uds)</option>
                <option value="bajo">🟠 Stock Crítico (≤ 3 uds)</option>
                <option value="agotado">🔴 Agotados (0 uds)</option>
              </select>
            </div>

            <div>
              <select id="filtroCatPVP" onchange="ComponenteInventarioPVP.filtrarCat(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500">
                <option value="todas">Todas las categorías</option>
              </select>
            </div>
          </div>

          <!-- TABLA CORPORATIVA CON COSTO REF Y PVP EDITABLES -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs min-w-[950px]" id="tablePVP">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="p-3 w-32">Código / SKU</th>
                  <th class="p-3">Nombre Comercial</th>
                  <th class="p-3">Categoría</th>
                  <th class="p-3 text-right">Costo Ref. (Factura)</th>
                  <th class="p-3 text-center w-28">Margen %</th>
                  <th class="p-3 text-right w-28 font-black text-emerald-700">PVP Venta ($)</th>
                  <th class="p-3 text-center">Stock Mostrador</th>
                  <th class="p-3 text-center w-24">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- MODAL CREAR / EDITAR PRODUCTO COMPLETO -->
      <div id="modalEditarPVP" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
          <div class="flex justify-between items-center border-b pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-800" id="mPvpTitulo">Editar Producto Comercial</h3>
              <p class="text-xs text-slate-400">Actualiza precios de mostrador y stock de venta</p>
            </div>
            <button onclick="ComponenteInventarioPVP.cerrarModal()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>
          
          <input type="hidden" id="pvpId">
          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nombre Comercial:</label>
              <input type="text" id="pvpNombre" class="w-full border border-slate-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Código de Barras / SKU:</label>
                <input type="text" id="pvpCodigo" class="w-full border border-slate-300 rounded-xl p-2 font-mono text-slate-700">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Categoría:</label>
                <input type="text" id="pvpCategoria" class="w-full border border-slate-300 rounded-xl p-2 font-medium">
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Stock Actual:</label>
                <input type="number" step="1" id="pvpStock" class="w-full border border-slate-300 rounded-xl p-2 text-center font-bold text-slate-800">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Costo ($):</label>
                <input type="number" step="0.01" id="pvpCosto" oninput="ComponenteInventarioPVP.recalcularPvpSugeridoModal(this.value)" class="w-full border border-slate-300 rounded-xl p-2 text-right font-mono text-slate-700">
              </div>
              <div>
                <label class="block font-black text-emerald-700 mb-1">PVP ($):</label>
                <input type="number" step="0.01" id="pvpPrecio" class="w-full border border-emerald-300 bg-emerald-50/50 rounded-xl p-2 text-right font-mono font-black text-emerald-800 text-sm">
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t pt-3">
            <button onclick="ComponenteInventarioPVP.cerrarModal()" class="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancelar</button>
            <button onclick="ComponenteInventarioPVP.guardar()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.cargarDatos();
  },

  async cargarDatos() {
    try {
      const data = await api.getProductosPVP();
      this.productos = Array.isArray(data) ? data : [];
      state.productosPVP = this.productos;
      this.renderKPIs();
      this.llenarCategorias();
      this.renderTabla();
    } catch (e) {
      console.error("Error al cargar inventario PVP:", e);
    }
  },

  renderKPIs() {
    let valorPVP = 0;
    let costoTotal = 0;
    let stockBajo = 0;
    let agotados = 0;

    this.productos.forEach(p => {
      const stock = parseFloat(p.stock_actual) || 0;
      const precio = parseFloat(p.pvp) || 0;
      const costo = parseFloat(p.costo_referencial) || 0;

      valorPVP += (stock * precio);
      costoTotal += (stock * costo);

      if (stock === 0) agotados++;
      else if (stock <= 3) stockBajo++;
    });

    const margenGlobal = costoTotal > 0 ? (((valorPVP - costoTotal) / costoTotal) * 100).toFixed(1) : 0;

    const elVal = document.getElementById("kpiValorTotalPVP");
    const elMarg = document.getElementById("kpiMargenTotalPVP");
    const elCost = document.getElementById("kpiCostoTotalPVP");
    const elTot = document.getElementById("kpiTotalProdsPVP");
    const elBajo = document.getElementById("kpiStockBajoPVP");
    const elAgot = document.getElementById("kpiAgotadosPVP");
    const elBadge = document.getElementById("badgeTotalItemsPVP");

    if (elVal) elVal.innerText = `$${valorPVP.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (elMarg) elMarg.innerText = `+${margenGlobal}% sobre costo`;
    if (elCost) elCost.innerText = `$${costoTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (elTot) elTot.innerText = `${this.productos.length} productos`;
    if (elBajo) elBajo.innerText = stockBajo;
    if (elAgot) elAgot.innerText = agotados;
    if (elBadge) elBadge.innerText = `${this.productos.length} productos`;
  },

  llenarCategorias() {
    const cats = [...new Set(this.productos.map(p => p.categoria || "General"))].sort();
    const select = document.getElementById("filtroCatPVP");
    if (!select) return;
    select.innerHTML = '<option value="todas">Todas las categorías</option>';
    cats.forEach(c => select.innerHTML += `<option value="${c}">${c}</option>`);
  },

  filtrar(q) {
    this.filtroTexto = (q || "").toLowerCase().trim();
    this.renderTabla();
  },

  filtrarCat(c) {
    this.filtroCategoria = c;
    this.renderTabla();
  },

  filtrarEstadoStock(estado) {
    this.filtroStockEstado = estado;
    this.renderTabla();
  },

  renderTabla() {
    const tbody = document.querySelector("#tablePVP tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtrados = this.productos.filter(p => {
      const stock = parseFloat(p.stock_actual) || 0;
      if (this.filtroStockEstado === "ok" && stock <= 3) return false;
      if (this.filtroStockEstado === "bajo" && (stock === 0 || stock > 3)) return false;
      if (this.filtroStockEstado === "agotado" && stock > 0) return false;

      if (this.filtroCategoria !== "todas" && p.categoria !== this.filtroCategoria) return false;

      if (this.filtroTexto) {
        const matchNom = p.nombre.toLowerCase().includes(this.filtroTexto);
        const matchCod = (p.codigo_barras || "").toLowerCase().includes(this.filtroTexto);
        if (!matchNom && !matchCod) return false;
      }
      return true;
    });

    if (filtrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-medium">No se encontraron productos con los filtros seleccionados.</td></tr>`;
      return;
    }

    filtrados.forEach(p => {
      const stock = parseFloat(p.stock_actual) || 0;
      const costo = parseFloat(p.costo_referencial) || 0;
      const pvp = parseFloat(p.pvp) || 0;
      const margen = costo > 0 ? (((pvp - costo) / costo) * 100).toFixed(0) : "0";

      let bgFila = "hover:bg-slate-50";
      let badgeStock = `<span id="badge-stock-${p.id}" class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">${stock} uds</span>`;

      if (stock === 0) {
        bgFila = "bg-rose-50/40 hover:bg-rose-100/60";
        badgeStock = `<span id="badge-stock-${p.id}" class="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300">Agotado (0)</span>`;
      } else if (stock <= 3) {
        bgFila = "bg-amber-50/30 hover:bg-amber-100/50";
        badgeStock = `<span id="badge-stock-${p.id}" class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black border border-amber-300">Crítico (${stock})</span>`;
      }

      tbody.innerHTML += `
        <tr class="${bgFila} transition border-b border-slate-100" id="fila-pvp-${p.id}">
          <td class="p-3 font-mono text-slate-500 text-[11px] font-bold">${p.codigo_barras || '-'}</td>
          <td class="p-3">
            <span class="font-bold text-slate-900 block leading-tight text-xs">${p.nombre}</span>
          </td>
          <td class="p-3 font-semibold text-slate-600">${p.categoria || 'General'}</td>
          
          <!-- Costo Ref. Editable en vivo (Costo de Factura) -->
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <span class="text-slate-400 font-bold text-xs">$</span>
              <input type="number" step="0.01" value="${costo.toFixed(2)}"
                     id="input-costo-${p.id}"
                     onchange="ComponenteInventarioPVP.cambiarCostoEnVivo(${p.id}, this.value)"
                     class="w-20 border border-slate-200 rounded-lg p-1 text-right font-mono font-medium text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>
          </td>

          <!-- Margen % en Tiempo Real -->
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <span class="text-slate-400 font-bold text-[11px]">+</span>
              <input type="number" step="1" value="${margen}" 
                     id="input-margen-${p.id}"
                     onchange="ComponenteInventarioPVP.cambiarMargenEnVivo(${p.id}, this.value)"
                     class="w-14 border border-slate-200 rounded-lg p-1 text-center font-mono font-bold text-xs text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="text-slate-400 font-bold text-[11px]">%</span>
            </div>
          </td>

          <!-- PVP en Tiempo Real -->
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <span class="text-emerald-700 font-bold text-xs">$</span>
              <input type="number" step="0.01" value="${pvp.toFixed(2)}" 
                     id="input-pvp-${p.id}"
                     onchange="ComponenteInventarioPVP.cambiarPvpEnVivo(${p.id}, this.value)"
                     class="w-20 border border-emerald-300 bg-emerald-50/40 rounded-lg p-1 text-right font-mono font-black text-xs text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            </div>
          </td>

          <!-- Ajuste Rápido de Stock (Optimistic UI) -->
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="ComponenteInventarioPVP.modificarStockInstantaneo(${p.id}, -1)" title="Disminuir stock" class="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-black cursor-pointer leading-none transition shadow-2xs active:scale-95">-</button>
              ${badgeStock}
              <button onclick="ComponenteInventarioPVP.modificarStockInstantaneo(${p.id}, 1)" title="Aumentar stock" class="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-black cursor-pointer leading-none transition shadow-2xs active:scale-95">+</button>
            </div>
          </td>

          <!-- Acciones: Editar y Eliminar Directo -->
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="ComponenteInventarioPVP.abrirModalEditar(${p.id})" title="Editar producto" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer transition">
                ✏️
              </button>
              <button onclick="ComponenteInventarioPVP.eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Eliminar de inventario" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-xs cursor-pointer transition">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  },

  async modificarStockInstantaneo(id, delta) {
    const prod = this.productos.find(x => x.id === id);
    if (!prod) return;

    const stockAnterior = prod.stock_actual;
    const nuevoStock = Math.max(0, (parseFloat(prod.stock_actual) || 0) + delta);
    prod.stock_actual = nuevoStock;

    const badge = document.getElementById(`badge-stock-${id}`);
    if (badge) {
      if (nuevoStock === 0) {
        badge.className = "px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300";
        badge.innerText = "Agotado (0)";
      } else if (nuevoStock <= 3) {
        badge.className = "px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black border border-amber-300";
        badge.innerText = `Crítico (${nuevoStock})`;
      } else {
        badge.className = "px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200";
        badge.innerText = `${nuevoStock} uds`;
      }
    }

    const fila = document.getElementById(`fila-pvp-${id}`);
    if (fila) {
      fila.classList.remove(
        "bg-rose-50/40", "hover:bg-rose-100/60",
        "bg-amber-50/30", "hover:bg-amber-100/50",
        "hover:bg-slate-50"
      );
      if (nuevoStock === 0) {
        fila.classList.add("bg-rose-50/40", "hover:bg-rose-100/60");
      } else if (nuevoStock <= 3) {
        fila.classList.add("bg-amber-50/30", "hover:bg-amber-100/50");
      } else {
        fila.classList.add("hover:bg-slate-50");
      }
    }

    this.renderKPIs();

    try {
      await api.ajustarStockPVP(id, delta);
    } catch (e) {
      prod.stock_actual = stockAnterior;
      this.renderTabla();
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Error al guardar stock en la base de datos.", "error");
      }
    }
  },

  async cambiarCostoEnVivo(id, nuevoCostoVal) {
    const prod = this.productos.find(x => x.id === id);
    if (!prod) return;

    const costo = Math.max(0, parseFloat(nuevoCostoVal) || 0);
    prod.costo_referencial = costo;

    const pvp = parseFloat(prod.pvp) || 0;
    const nuevoMargen = costo > 0 ? (((pvp - costo) / costo) * 100).toFixed(0) : "0";

    const inputMargen = document.getElementById(`input-margen-${id}`);
    if (inputMargen) inputMargen.value = nuevoMargen;

    this.renderKPIs();

    try {
      await api.actualizarPrecioRapidoPVP(id, { costo_referencial: costo, pvp: pvp });
      if (typeof window.mostrarToast === "function") window.mostrarToast("Costo de referencia actualizado", "success");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async cambiarMargenEnVivo(id, nuevoMargenPct) {
    const prod = this.productos.find(x => x.id === id);
    if (!prod) return;

    const costo = parseFloat(prod.costo_referencial) || 0;
    const pct = parseFloat(nuevoMargenPct) || 0;
    const nuevoPvp = +(costo * (1 + pct / 100)).toFixed(2);

    prod.pvp = nuevoPvp;

    const inputPvp = document.getElementById(`input-pvp-${id}`);
    if (inputPvp) inputPvp.value = nuevoPvp.toFixed(2);

    this.renderKPIs();

    try {
      await api.actualizarPrecioRapidoPVP(id, { pvp: nuevoPvp, costo_referencial: costo });
      if (typeof window.mostrarToast === "function") window.mostrarToast("PVP actualizado por margen", "success");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async cambiarPvpEnVivo(id, nuevoPvpVal) {
    const prod = this.productos.find(x => x.id === id);
    if (!prod) return;

    const pvp = Math.max(0, parseFloat(nuevoPvpVal) || 0);
    const costo = parseFloat(prod.costo_referencial) || 0;
    prod.pvp = pvp;

    const nuevoMargen = costo > 0 ? (((pvp - costo) / costo) * 100).toFixed(0) : "0";
    const inputMargen = document.getElementById(`input-margen-${id}`);
    if (inputMargen) inputMargen.value = nuevoMargen;

    this.renderKPIs();

    try {
      await api.actualizarPrecioRapidoPVP(id, { pvp: pvp, costo_referencial: costo });
      if (typeof window.mostrarToast === "function") window.mostrarToast("Precio PVP actualizado", "success");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async eliminarProducto(id, nombre) {
    const seguro = await window.confirmarAccion(
      `¿Eliminar definitivamente "${nombre}"?`,
      "El producto se removerá del inventario comercial y de la terminal POS."
    );
    if (!seguro) return;

    try {
      await api.eliminarProductoPVP(id);
      this.productos = this.productos.filter(x => x.id !== id);
      state.productosPVP = this.productos;
      this.renderKPIs();
      this.renderTabla();
      const bPvp = document.getElementById("badgeNavPVP");
      if (bPvp) bPvp.innerText = this.productos.length;
      if (typeof window.mostrarToast === "function") window.mostrarToast("Producto eliminado", "info");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async purgarAgotados() {
    const seguro = await window.confirmarAccion(
      "¿Purgar productos agotados?",
      "Se eliminarán permanentemente del catálogo todos los ítems con stock en 0."
    );
    if (!seguro) return;

    try {
      await api.limpiarAgotadosPVP();
      await this.cargarDatos();
      const bPvp = document.getElementById("badgeNavPVP");
      if (bPvp) bPvp.innerText = this.productos.length;
      if (typeof window.mostrarToast === "function") window.mostrarToast("Agotados eliminados con éxito", "success");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async procesarEscaneo(e) {
    if (e.key === "Enter") {
      const val = e.target.value.trim().toLowerCase();
      if (!val) return;

      const prod = this.productos.find(p => 
        (p.codigo_barras && p.codigo_barras.toLowerCase() === val) || 
        p.nombre.toLowerCase().includes(val)
      );

      if (prod) {
        if (parseFloat(prod.stock_actual) <= 0) {
          if (typeof window.mostrarToast === "function") {
            window.mostrarToast(`¡Alerta! "${prod.nombre}" no tiene existencias.`, "warning");
          }
          return;
        }
        await this.modificarStockInstantaneo(prod.id, -1);
        if (typeof window.mostrarToast === "function") {
          window.mostrarToast(`Despachado: ${prod.nombre} (-1 ud)`, "info");
        }
        e.target.value = "";
      } else {
        if (typeof window.mostrarToast === "function") {
          window.mostrarToast("Producto no encontrado en el catálogo PVP.", "error");
        }
      }
    }
  },

  recalcularPvpSugeridoModal(costoVal) {
    const c = parseFloat(costoVal) || 0;
    if (c > 0) {
      document.getElementById("pvpPrecio").value = (c * 1.35).toFixed(2);
    }
  },

  abrirModalNuevo() {
    document.getElementById("mPvpTitulo").innerText = "Nuevo Producto Comercial";
    document.getElementById("pvpId").value = "";
    document.getElementById("pvpNombre").value = "";
    document.getElementById("pvpCodigo").value = "";
    document.getElementById("pvpCategoria").value = "General";
    document.getElementById("pvpStock").value = "1";
    document.getElementById("pvpCosto").value = "0.00";
    document.getElementById("pvpPrecio").value = "0.00";
    document.getElementById("modalEditarPVP").classList.remove("hidden");
  },

  abrirModalEditar(id) {
    const p = this.productos.find(x => x.id === id);
    if (!p) return;
    document.getElementById("mPvpTitulo").innerText = "Editar Producto Comercial";
    document.getElementById("pvpId").value = p.id;
    document.getElementById("pvpNombre").value = p.nombre;
    document.getElementById("pvpCodigo").value = p.codigo_barras || "";
    document.getElementById("pvpCategoria").value = p.categoria || "General";
    document.getElementById("pvpStock").value = p.stock_actual;
    document.getElementById("pvpCosto").value = (parseFloat(p.costo_referencial) || 0).toFixed(2);
    document.getElementById("pvpPrecio").value = (parseFloat(p.pvp) || 0).toFixed(2);
    document.getElementById("modalEditarPVP").classList.remove("hidden");
  },

  cerrarModal() {
    document.getElementById("modalEditarPVP")?.classList.add("hidden");
  },

  async guardar() {
    const payload = {
      id: document.getElementById("pvpId").value ? parseInt(document.getElementById("pvpId").value) : null,
      nombre: document.getElementById("pvpNombre").value.trim(),
      codigo_barras: document.getElementById("pvpCodigo").value.trim() || null,
      categoria: document.getElementById("pvpCategoria").value.trim() || "General",
      stock_actual: parseFloat(document.getElementById("pvpStock").value) || 0,
      costo_referencial: parseFloat(document.getElementById("pvpCosto").value) || 0,
      pvp: parseFloat(document.getElementById("pvpPrecio").value) || 0,
    };

    if (!payload.nombre || payload.pvp <= 0) {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Ingresa un nombre comercial y un PVP válido mayor a 0.", "warning");
      }
      return;
    }

    try {
      await api.guardarProductoPVP(payload);
      this.cerrarModal();
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Producto guardado exitosamente.", "success");
      }
      await this.cargarDatos();
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  abrirImportadorAronium() {
    document.getElementById("inputCsvAronium").click();
  },

  async procesarArchivoCsv(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${API_URL}/pvp/importar-csv-aronium`, {
        method: "POST",
        body: fd
      });
      if (!res.ok) throw new Error("Fallo en la importación de Aronium.");
      const data = await res.json();
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast(`Sincronización exitosa: ${data.insertados || 0} nuevos, ${data.actualizados || 0} actualizados.`, "success");
      }
      await this.cargarDatos();
    } catch (err) {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Error importando Aronium: " + err.message, "error");
      }
    } finally {
      e.target.value = "";
    }
  }
};

window.ComponenteInventarioPVP = ComponenteInventarioPVP;