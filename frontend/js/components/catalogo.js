const ComponenteCatalogo = {
  filtroTexto: "",
  filtroCategoria: "todas",
  miGraficoCategorias: null,

  template() {
    return `
      <div class="space-y-6">
        
        <!-- SECCIÓN 1: BI & ANALÍTICA DE CATEGORÍAS -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Distribución de Gasto</h2>
              <p class="text-xs text-slate-400">Proporción del presupuesto por especialidad clínica</p>
            </div>
            <div class="relative h-52 w-full mt-2 flex items-center justify-center">
              <canvas id="chartCategoriasDoughnut"></canvas>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-2">
                <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Inversión y Volumen por Categoría</h2>
                <span class="text-xs text-slate-400" id="lblTotalCategoriasActivas">0 categorías</span>
              </div>
              <p class="text-xs text-slate-400 mb-3">Concentración de compras de insumos dentales</p>
            </div>
            
            <div class="overflow-y-auto max-h-52 border rounded-xl">
              <table class="w-full text-left text-xs" id="tableResumenCategorias">
                <thead class="bg-slate-50 border-b text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th class="p-2.5">Especialidad / Categoría</th>
                    <th class="p-2.5 text-center">Unidades</th>
                    <th class="p-2.5 text-right">Inversión Total</th>
                    <th class="p-2.5 text-right">% Gasto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: BUSCADOR REACTIVO EN VIVO -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                🔍 Búsqueda Rápida de Insumos y Comparador
              </h2>
              <p class="text-xs text-slate-400">Consulta el mejor proveedor y dispersión de precios al instante</p>
            </div>
            <div class="relative w-full sm:w-80">
              <input type="text" id="inputBuscarProdLive" oninput="ComponenteCatalogo.buscarEnVivo(this.value)" placeholder="Escribe insumo (ej: Resina, Guantes, Conos)..." 
                     class="border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
              <span class="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
            </div>
          </div>

          <div id="resBuscadorProdLive" class="hidden border-t pt-3 mt-2">
            <div class="text-xs font-semibold text-slate-500 mb-2" id="contadorResultadosLive"></div>
            <div id="contenedorTarjetasLive" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
          </div>
        </div>

        <!-- SECCIÓN 3: CATÁLOGO MAESTRO DE PRODUCTOS -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-800">Catálogo Maestro de Insumos</h2>
                <span id="badgeConteoCatalogo" class="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                  0 productos
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Control de precios históricos, dispersión y reasignación de categorías en vivo</p>
            </div>

            <div class="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
              <input type="text" id="filtroTxtCatalogo" oninput="ComponenteCatalogo.filtrarTexto(this.value)" placeholder="Filtrar por insumo o proveedor..." 
                     class="border border-slate-300 rounded-xl px-3 py-2 text-xs w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
              
              <select id="filtroCatSelect" onchange="ComponenteCatalogo.filtrarCategoria(this.value)" class="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 text-slate-700 font-bold focus:ring-2 focus:ring-blue-500">
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
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs min-w-[850px]" id="tableCatMaestro">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase">
                <tr>
                  <th class="p-3">Producto / Presentación</th>
                  <th class="p-3 w-44">Categoría Asignada</th>
                  <th class="p-3 text-center">Compras</th>
                  <th class="p-3 text-center">Uds</th>
                  <th class="p-3 text-right">Último</th>
                  <th class="p-3 text-right font-black text-emerald-700">Mínimo</th>
                  <th class="p-3 text-right font-bold text-slate-700">Máximo</th>
                  <th class="p-3 text-right font-bold text-blue-700">Promedio</th>
                  <th class="p-3 text-center w-24">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100"></tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  init() {
    this.renderGraficoYResumenCategorias();
    this.renderTablaCatalogo();
  },

  renderGraficoYResumenCategorias() {
    const conteoCategorias = {};
    let totalInversion = 0;

    state.facturasTodas.forEach(f => {
      (f.items || []).forEach(it => {
        const cat = it.categoria || "General";
        const cant = parseFloat(it.cantidad) || 0;
        const sub = parseFloat(it.subtotal || it.precio_total || (cant * (it.precio_unitario || 0))) || 0;

        if (cat !== "Gasto Operativo") {
          totalInversion += sub;
          if (!conteoCategorias[cat]) {
            conteoCategorias[cat] = { unidades: 0, monto: 0 };
          }
          conteoCategorias[cat].unidades += cant;
          conteoCategorias[cat].monto += sub;
        }
      });
    });

    const arrCat = Object.keys(conteoCategorias).map(c => ({
      categoria: c,
      unidades: conteoCategorias[c].unidades,
      monto: conteoCategorias[c].monto
    })).sort((a, b) => b.monto - a.monto);

    const lbl = document.getElementById("lblTotalCategoriasActivas");
    if (lbl) lbl.innerText = `${arrCat.length} categorías activas`;

    // Renderizar tabla de inversión por categoría
    const tbodyRes = document.querySelector("#tableResumenCategorias tbody");
    if (tbodyRes) {
      tbodyRes.innerHTML = "";
      if (arrCat.length === 0) {
        tbodyRes.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Sin compras registradas aún.</td></tr>`;
      } else {
        arrCat.forEach(c => {
          const pct = totalInversion > 0 ? ((c.monto / totalInversion) * 100).toFixed(1) : 0;
          tbodyRes.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
              <td class="p-2.5 font-bold text-slate-700">${c.categoria}</td>
              <td class="p-2.5 text-center font-mono text-slate-600">${c.unidades}</td>
              <td class="p-2.5 text-right font-black font-mono text-slate-900">$${c.monto.toFixed(2)}</td>
              <td class="p-2.5 text-right font-bold text-blue-600 font-mono">${pct}%</td>
            </tr>
          `;
        });
      }
    }

    // Renderizar Donut Chart con validación
    const ctx = document.getElementById("chartCategoriasDoughnut");
    if (ctx && typeof Chart !== "undefined" && arrCat.length > 0) {
      if (this.miGraficoCategorias) this.miGraficoCategorias.destroy();

      const colores = [
        "rgba(37, 99, 235, 0.85)", "rgba(16, 185, 129, 0.85)", "rgba(245, 158, 11, 0.85)",
        "rgba(139, 92, 246, 0.85)", "rgba(239, 68, 68, 0.85)", "rgba(14, 165, 233, 0.85)",
        "rgba(236, 72, 153, 0.85)", "rgba(100, 116, 139, 0.85)", "rgba(20, 184, 166, 0.85)"
      ];

      this.miGraficoCategorias = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: arrCat.map(c => c.categoria),
          datasets: [{
            data: arrCat.map(c => c.monto),
            backgroundColor: colores.slice(0, arrCat.length),
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 9 } } },
            tooltip: {
              callbacks: {
                label: (c) => ` $${c.raw.toFixed(2)} (${totalInversion > 0 ? ((c.raw / totalInversion) * 100).toFixed(1) : 0}%)`
              }
            }
          },
          cutout: "65%"
        }
      });
    }
  },

  filtrarTexto(val) {
    this.filtroTexto = (val || "").toLowerCase().trim();
    this.renderTablaCatalogo();
  },

  filtrarCategoria(val) {
    this.filtroCategoria = val;
    this.renderTablaCatalogo();
  },

  renderTablaCatalogo() {
    const tbody = document.querySelector("#tableCatMaestro tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const catalogo = state.catalogo || state.catalogoMaestro || [];
    const filtrados = catalogo.filter(p => {
      const matchTexto = !this.filtroTexto || 
        p.producto.toLowerCase().includes(this.filtroTexto) || 
        (p.proveedores && p.proveedores.some(pr => pr.toLowerCase().includes(this.filtroTexto)));
      
      const matchCat = (this.filtroCategoria === "todas") || (p.categoria === this.filtroCategoria);
      return matchTexto && matchCat;
    });

    const badge = document.getElementById("badgeConteoCatalogo");
    if (badge) badge.innerText = `${filtrados.length} productos`;

    if (filtrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">No hay productos que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    filtrados.forEach((prod, index) => {
      const cats = (typeof CATEGORIAS_SISTEMA !== "undefined" && CATEGORIAS_SISTEMA.length) ? CATEGORIAS_SISTEMA : [
        "General", "Restauración & Estética", "Endodoncia", "Ortodoncia",
        "Periodoncia & Profilaxis", "Impresión & Modelos", "Prótesis & Laboratorio",
        "Instrumental & Fresas", "Bioseguridad & Esterilización", "Equipos & Repuestos"
      ];

      const opcionesCat = cats.map(c => 
        `<option value="${c}" ${prod.categoria === c ? 'selected' : ''}>${c}</option>`
      ).join('');

      const historial = prod.historial || [];
      const pMin = parseFloat(prod.precio_min || 0);
      const pMax = parseFloat(prod.precio_max || 0);
      const diffAhorro = pMax > pMin ? (pMax - pMin).toFixed(2) : 0;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-3">
            <span class="font-bold text-slate-800 text-xs block">${prod.producto}</span>
            <span class="text-[11px] text-slate-400 block mt-0.5">
              Mejor proveedor: <strong class="text-emerald-700">${prod.mejor_proveedor || 'N/A'}</strong>
              ${diffAhorro > 0 ? `<span class="text-emerald-600 font-bold ml-1.5">(Ahorro hasta $${diffAhorro})</span>` : ''}
            </span>
          </td>
          <td class="p-3">
            <select onchange="ComponenteCatalogo.cambiarCategoria('${encodeURIComponent(prod.producto)}', this.value)" 
                    class="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 w-full">
              ${opcionesCat}
            </select>
          </td>
          <td class="p-3 text-center font-mono font-bold text-slate-700">${prod.total_compras || historial.length || 1}</td>
          <td class="p-3 text-center font-mono font-bold text-slate-700">${prod.unidades_totales || '-'}</td>
          <td class="p-3 text-right font-mono text-slate-600">$${parseFloat(prod.ultimo_precio || (historial[0] ? historial[0].precio : 0)).toFixed(2)}</td>
          <td class="p-3 text-right font-mono font-black text-emerald-700">$${pMin.toFixed(2)}</td>
          <td class="p-3 text-right font-mono font-bold text-slate-700">$${pMax.toFixed(2)}</td>
          <td class="p-3 text-right font-mono font-black text-blue-700">$${parseFloat(prod.precio_promedio || 0).toFixed(2)}</td>
          <td class="p-3 text-center">
            <button onclick="ComponenteCatalogo.toggleHistorial(${index})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition">
              Compras ▼
            </button>
          </td>
        </tr>
        
        <!-- ACORDEÓN DESPLEGABLE CON HISTORIAL DE FACTURAS -->
        <tr id="historial-cat-fila-${index}" class="hidden bg-slate-50/70 border-b">
          <td colspan="9" class="p-3">
            <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
              <span class="text-xs font-bold text-slate-700 mb-2 block flex items-center gap-1.5">
                📋 Registro histórico de facturas para: <strong class="text-blue-700">${prod.producto}</strong>
              </span>
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b text-slate-500 font-semibold">
                  <tr>
                    <th class="p-1.5">Fecha</th>
                    <th class="p-1.5">Factura N°</th>
                    <th class="p-1.5">Proveedor</th>
                    <th class="p-1.5 text-center">Cant.</th>
                    <th class="p-1.5 text-right">Precio Unit.</th>
                    <th class="p-1.5 text-center">% Dcto</th>
                    <th class="p-1.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${historial.map(h => `
                    <tr class="hover:bg-slate-50">
                      <td class="p-1.5 text-slate-600 font-mono">${formatearFechaLatam(h.fecha)}</td>
                      <td class="p-1.5 font-mono font-bold text-slate-700">#${h.factura || h.numero_factura || 'S/N'}</td>
                      <td class="p-1.5 font-semibold text-slate-800">${h.proveedor}</td>
                      <td class="p-1.5 text-center font-mono">${h.cantidad}</td>                       <td class="p-1.5 text-right font-mono font-bold text-slate-900">$${parseFloat(h.precio || 0).toFixed(2)}</td>
                      <td class="p-1.5 text-center font-mono text-amber-700 font-bold">${h.descuento > 0 ? h.descuento + '\%' : '-'}</td>                       <td class="p-1.5 text-right font-mono font-black text-slate-900">$${((parseFloat(h.cantidad)||1) * (parseFloat(h.precio)||0) * (1 - ((parseFloat(h.descuento)||0)/100))).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    });
  },

  toggleHistorial(index) {
    const el = document.getElementById(`historial-cat-fila-${index}`);
    if (el) el.classList.toggle("hidden");
  },

  async cambiarCategoria(prodEncoded, nuevaCat) {
    const prod = decodeURIComponent(prodEncoded);
    try {
      await api.actualizarCategoria(prod, nuevaCat);
      const item = (state.catalogo || []).find(p => p.producto === prod);
      if (item) item.categoria = nuevaCat;
      
      state.facturasTodas.forEach(f => {
        (f.items || []).forEach(it => {
          if (it.descripcion === prod) it.categoria = nuevaCat;
        });
      });

      this.renderGraficoYResumenCategorias();
      alert(`Categoría de "${prod}" actualizada a "${nuevaCat}"`);
    } catch (e) {
      alert("Error al actualizar categoría: " + e.message);
    }
  },

  timeoutSearch: null,
  buscarEnVivo(q) {
    clearTimeout(this.timeoutSearch);
    const query = (q || "").trim();
    const cont = document.getElementById("resBuscadorProdLive");
    const grid = document.getElementById("contenedorTarjetasLive");
    const contador = document.getElementById("contadorResultadosLive");

    if (query.length < 2) {
      if (cont) cont.classList.add("hidden");
      return;
    }

    this.timeoutSearch = setTimeout(async () => {
      try {
        const res = await api.buscarProductos(query);
        const prods = res.productos_agrupados || [];

        if (prods.length === 0) {
          if (contador) contador.innerText = `No se encontraron insumos para "${query}".`;
          if (grid) grid.innerHTML = "";
          if (cont) cont.classList.remove("hidden");
          return;
        }

        if (contador) contador.innerText = `Se encontraron ${prods.length} productos coincidentes:`;
        if (grid) {
          grid.innerHTML = "";
          prods.forEach(p => {
            grid.innerHTML += `
              <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/70 shadow-2xs space-y-2">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-bold text-slate-800 text-xs">${p.producto}</h3>
                    <span class="text-[10px] text-slate-500 font-medium">Mejor opción: <strong class="text-emerald-700">${p.mejor_proveedor}</strong></span>
                  </div>
                  <span class="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded border">${p.categoria}</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                  <div class="bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg">
                    <span class="block text-[9px] text-emerald-800 font-bold uppercase">Mínimo</span>
                    <span class="text-xs font-black text-emerald-700 font-mono">$${parseFloat(p.precio_min||0).toFixed(2)}</span>
                  </div>
                  <div class="bg-white border border-slate-200 p-1.5 rounded-lg">
                    <span class="block text-[9px] text-slate-400 font-bold uppercase">Promedio</span>
                    <span class="text-xs font-black text-blue-700 font-mono">$${parseFloat(p.precio_promedio||0).toFixed(2)}</span>
                  </div>
                  <div class="bg-white border border-slate-200 p-1.5 rounded-lg">
                    <span class="block text-[9px] text-slate-400 font-bold uppercase">Máximo</span>
                    <span class="text-xs font-black text-slate-800 font-mono">$${parseFloat(p.precio_max||0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            `;
          });
        }

        if (cont) cont.classList.remove("hidden");
      } catch (err) {
        console.error(err);
      }
    }, 250);
  }
};

window.ComponenteCatalogo = ComponenteCatalogo;