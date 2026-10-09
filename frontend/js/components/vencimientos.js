const ComponenteVencimientos = {
  itemsCaducidad: [],
  filtroRiesgo: "todos",
  filtroCategoria: "todas",
  filtroEstadoStock: "activo", // 'activo', 'agotado', 'todos'
  filtroTexto: "",

  template() {
    return `
      <div class="space-y-6">

        <!-- 1. KPIS FINANCIEROS Y CAPITAL EN RIESGO -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl border border-rose-200 shadow-sm">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Ya Vencidos
              </span>
              <span class="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">Cuarentena</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiCantVencidos" class="text-3xl font-black text-rose-700 tracking-tight">0</span>
              <span class="text-xs text-rose-500 font-semibold">lotes activos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-rose-100 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Pérdida en stock:</span>
              <span class="font-mono font-black text-rose-700" id="kpiDineroVencido">$0.00</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span> Crítico (≤ 60 días)
              </span>
              <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">Uso Inmediato</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiCantCriticos" class="text-3xl font-black text-amber-700 tracking-tight">0</span>
              <span class="text-xs text-amber-500 font-semibold">lotes activos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-amber-100 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Capital en riesgo:</span>
              <span class="font-mono font-black text-amber-700" id="kpiDineroCritico">$0.00</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200 shadow-sm">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span> Medio Plazo (61-180d)
              </span>
              <span class="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">Plan FEFO</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiCantMedios" class="text-3xl font-black text-blue-700 tracking-tight">0</span>
              <span class="text-xs text-blue-500 font-semibold">lotes activos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-blue-100 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">En rotación:</span>
              <span class="font-mono font-black text-blue-700" id="kpiDineroMedio">$0.00</span>
            </div>
          </div>

          <div class="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Óptimo (> 180 días)
              </span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">Seguro</span>
            </div>
            <div class="flex items-baseline gap-2 mt-2">
              <span id="kpiCantSeguros" class="text-3xl font-black text-emerald-700 tracking-tight">0</span>
              <span class="text-xs text-emerald-500 font-semibold">lotes activos</span>
            </div>
            <div class="mt-2 pt-2 border-t border-emerald-100 flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Stock respaldo:</span>
              <span class="font-mono font-black text-emerald-700" id="kpiDineroSeguro">$0.00</span>
            </div>
          </div>

        </div>

        <!-- 2. BARRA DE FILTROS Y ESTADO DE STOCK -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-800">Control de Lotes y Vencimientos</h2>
                <span id="badgeTotalItemsAuditados" class="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                  0 insumos rastreados
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Marca como vendido/consumido para descontarlo del riesgo de pérdida</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="ComponenteVencimientos.exportarCSV()" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer">
                📊 Descargar Excel (CSV)
              </button>
            </div>
          </div>

          <!-- Filtros -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            
            <!-- Buscador -->
            <div class="relative">
              <input type="text" id="filtroTxtVencimientos" oninput="ComponenteVencimientos.filtrarTexto(this.value)" placeholder="Buscar insumo, lote o proveedor..." 
                     class="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium">
              <span class="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
            </div>

            <!-- Filtro de Existencia en Bodega -->
            <div>
              <select id="selectFiltroEstadoStock" onchange="ComponenteVencimientos.filtrarEstadoStock(this.value)" class="w-full border border-blue-300 bg-blue-50/60 text-blue-900 rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-blue-500">
                <option value="activo" selected>🟢 En Stock (Solo Activos)</option>
                <option value="agotado">⚪ Ya Vendidos / Consumidos</option>
                <option value="todos">📋 Mostrar Todos (Activos y Bajas)</option>
              </select>
            </div>

            <!-- Filtro por Plazo de Riesgo -->
            <div>
              <select id="selectFiltroRiesgo" onchange="ComponenteVencimientos.filtrarRiesgo(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 font-bold focus:ring-2 focus:ring-blue-500">
                <option value="todos" selected>Todos los plazos</option>
                <option value="urgentes">⚠️ Urgentes (Vencidos + ≤ 60d)</option>
                <option value="vencidos">🔴 Solo Vencidos</option>
                <option value="criticos">🟠 Críticos (≤ 60 días)</option>
                <option value="medios">🟡 Medio Plazo (61 a 180d)</option>
                <option value="seguros">🟢 Seguro (> 180 días)</option>
              </select>
            </div>

            <!-- Filtro de Categoría -->
            <div>
              <select id="selectFiltroCatVenc" onchange="ComponenteVencimientos.filtrarCategoria(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500">
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

          <!-- TABLA PRINCIPAL CON BOTÓN DE GESTIÓN DE STOCK -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs min-w-[950px]" id="tableVencimientosMaster">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="p-3">Insumo Dental</th>
                  <th class="p-3">Categoría</th>
                  <th class="p-3 text-center">Lote</th>
                  <th class="p-3 text-center">Cant. / Inversión</th>
                  <th class="p-3">Factura de Origen</th>
                  <th class="p-3 text-center">Caducidad (EXP)</th>
                  <th class="p-3 text-center">Días Restantes</th>
                  <th class="p-3 text-center min-w-[180px]">Gestión de Stock</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100"></tbody>
            </table>
          </div>

        </div>

      </div>

      <!-- MODAL PARA INSPECCIONAR FACTURA DE ORIGEN -->
      <div id="modalVencFacturaRapida" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col">
          <div class="flex justify-between items-start border-b pb-3 mb-3">
            <div>
              <h3 class="text-base font-bold text-slate-800" id="modalVencFacTitulo">Factura de Origen</h3>
              <p class="text-xs text-slate-500" id="modalVencFacSubtitulo"></p>
            </div>
            <button onclick="ComponenteVencimientos.cerrarModalFactura()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none cursor-pointer">&times;</button>
          </div>
          
          <!-- Botones de Enlace a la Nube y de Edición Directa -->
          <div class="mb-3 flex flex-wrap gap-2 items-center justify-between">
            <div id="modalVencFacEnlaces" class="flex flex-wrap gap-2"></div>
            <div id="modalVencFacBtnEditar"></div>
          </div>

          <div class="overflow-y-auto flex-1 border rounded-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold">
                <tr>
                  <th class="p-2">Insumo</th>
                  <th class="p-2 text-center">Lote</th>
                  <th class="p-2 text-center">Cant.</th>
                  <th class="p-2 text-right">P. Unit.</th>
                  <th class="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody id="modalVencFacItems" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>
          <div class="mt-3 text-right font-black text-slate-900 text-sm" id="modalVencFacTotal"></div>
        </div>
      </div>
    `;
  },

  getLotesAgotados() {
    try {
      return JSON.parse(localStorage.getItem("mobadent_lotes_agotados") || "{}");
    } catch {
      return {};
    }
  },

  guardarLoteAgotado(clave, agotado) {
    const mapa = this.getLotesAgotados();
    if (agotado) {
      mapa[clave] = true;
    } else {
      delete mapa[clave];
    }
    localStorage.setItem("mobadent_lotes_agotados", JSON.stringify(mapa));
  },

  init() {
    this.procesarCaducidades();
    this.renderKPIs();
    this.renderTabla();
  },

  procesarCaducidades() {
    this.itemsCaducidad = [];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const hoyTime = new Date(hoyStr).getTime();
    const mapaAgotados = this.getLotesAgotados();

    state.facturasTodas.forEach(f => {
      (f.items || []).forEach((it) => {
        const expIso = window.parsearFechaISO ? window.parsearFechaISO(it.fecha_caducidad) : (it.fecha_caducidad ? it.fecha_caducidad.slice(0, 10) : null);
        if (expIso) {
          const expTime = new Date(expIso).getTime();
          const dias = Math.ceil((expTime - hoyTime) / (1000 * 60 * 60 * 24));
          const cant = parseFloat(it.cantidad) || 1;
          const pu = parseFloat(it.precio_unitario) || 0;
          const sub = parseFloat(it.precio_total || it.subtotal || (cant * pu)) || 0;

          const claveItem = `f${f.id}_lote_${String(it.lote || 'NA').trim()}_${String(it.descripcion).slice(0, 15)}`;
          const estaAgotado = Boolean(mapaAgotados[claveItem]);

          let nivel = "seguro";
          let accion = "Stock normal";

          if (dias < 0) {
            nivel = "vencido";
            accion = "🚨 Descartar / Cuarentena";
          } else if (dias <= 60) {
            nivel = "critico";
            accion = "⚡ Rotar de inmediato";
          } else if (dias <= 180) {
            nivel = "medio";
            accion = "📦 Despachar primero (FEFO)";
          }

          this.itemsCaducidad.push({
            clave: claveItem,
            descripcion: it.descripcion,
            categoria: it.categoria || "General",
            lote: it.lote || "N/A",
            cantidad: cant,
            precio_unitario: pu,
            inversion_total: sub,
            proveedor: f.proveedor,
            factura_id: f.id,
            factura_num: f.numero_factura,
            fecha_exp_iso: expIso,
            fecha_exp_latam: window.formatearFechaLatam ? window.formatearFechaLatam(expIso) : expIso,
            dias_restantes: dias,
            nivel_riesgo: nivel,
            accion: accion,
            agotado: estaAgotado
          });
        }
      });
    });

    this.itemsCaducidad.sort((a, b) => a.dias_restantes - b.dias_restantes);
  },

  renderKPIs() {
    let cantVenc = 0, dineroVenc = 0;
    let cantCrit = 0, dineroCrit = 0;
    let cantMed = 0, dineroMed = 0;
    let cantSeg = 0, dineroSeg = 0;

    this.itemsCaducidad.forEach(it => {
      if (it.agotado) return;

      if (it.nivel_riesgo === "vencido") {
        cantVenc++;
        dineroVenc += it.inversion_total;
      } else if (it.nivel_riesgo === "critico") {
        cantCrit++;
        dineroCrit += it.inversion_total;
      } else if (it.nivel_riesgo === "medio") {
        cantMed++;
        dineroMed += it.inversion_total;
      } else {
        cantSeg++;
        dineroSeg += it.inversion_total;
      }
    });

    const elVenc = document.getElementById("kpiCantVencidos");
    const elVencDin = document.getElementById("kpiDineroVencido");
    const elCrit = document.getElementById("kpiCantCriticos");
    const elCritDin = document.getElementById("kpiDineroCritico");
    const elMed = document.getElementById("kpiCantMedios");
    const elMedDin = document.getElementById("kpiDineroMedio");
    const elSeg = document.getElementById("kpiCantSeguros");
    const elSegDin = document.getElementById("kpiDineroSeguro");
    const badgeAud = document.getElementById("badgeTotalItemsAuditados");

    if (elVenc) elVenc.innerText = cantVenc;
    if (elVencDin) elVencDin.innerText = `$${dineroVenc.toFixed(2)}`;
    if (elCrit) elCrit.innerText = cantCrit;
    if (elCritDin) elCritDin.innerText = `$${dineroCrit.toFixed(2)}`;
    if (elMed) elMed.innerText = cantMed;
    if (elMedDin) elMedDin.innerText = `$${dineroMed.toFixed(2)}`;
    if (elSeg) elSeg.innerText = cantSeg;
    if (elSegDin) elSegDin.innerText = `$${dineroSeg.toFixed(2)}`;
    if (badgeAud) badgeAud.innerText = `${this.itemsCaducidad.length} insumos registrados`;
  },

  filtrarTexto(val) {
    this.filtroTexto = (val || "").toLowerCase().trim();
    this.renderTabla();
  },

  filtrarRiesgo(val) {
    this.filtroRiesgo = val;
    this.renderTabla();
  },

  filtrarCategoria(val) {
    this.filtroCategoria = val;
    this.renderTabla();
  },

  filtrarEstadoStock(val) {
    this.filtroEstadoStock = val;
    this.renderTabla();
  },

  alternarEstadoAgotado(clave) {
    const item = this.itemsCaducidad.find(x => x.clave === clave);
    if (!item) return;

    item.agotado = !item.agotado;
    this.guardarLoteAgotado(clave, item.agotado);
    this.renderKPIs();
    this.renderTabla();
    if (typeof window.mostrarToast === "function") {
      window.mostrarToast(item.agotado ? `Lote ${item.lote} marcado como consumido.` : `Lote ${item.lote} reingresado a stock.`, "info");
    }
  },

  renderTabla() {
    const tbody = document.querySelector("#tableVencimientosMaster tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtrados = this.itemsCaducidad.filter(it => {
      if (this.filtroEstadoStock === "activo" && it.agotado) return false;
      if (this.filtroEstadoStock === "agotado" && !it.agotado) return false;

      if (this.filtroRiesgo === "urgentes" && it.nivel_riesgo !== "vencido" && it.nivel_riesgo !== "critico") return false;
      if (this.filtroRiesgo === "vencidos" && it.nivel_riesgo !== "vencido") return false;
      if (this.filtroRiesgo === "criticos" && it.nivel_riesgo !== "critico") return false;
      if (this.filtroRiesgo === "medios" && it.nivel_riesgo !== "medio") return false;
      if (this.filtroRiesgo === "seguros" && it.nivel_riesgo !== "seguro") return false;

      if (this.filtroCategoria !== "todas" && it.categoria !== this.filtroCategoria) return false;

      if (this.filtroTexto) {
        const mDesc = it.descripcion.toLowerCase().includes(this.filtroTexto);
        const mLot = it.lote.toLowerCase().includes(this.filtroTexto);
        const mProv = it.proveedor.toLowerCase().includes(this.filtroTexto);
        const mFac = String(it.factura_num).toLowerCase().includes(this.filtroTexto);
        if (!mDesc && !mLot && !mProv && !mFac) return false;
      }

      return true;
    });

    if (filtrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-medium">No hay insumos con los filtros seleccionados.</td></tr>`;
      return;
    }

    filtrados.forEach(it => {
      let badgeDias = "";
      let bgFila = "hover:bg-slate-50";

      if (it.agotado) {
        bgFila = "bg-slate-50 opacity-60";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">✓ Consumido / Baja</span>`;
      } else if (it.nivel_riesgo === "vencido") {
        bgFila = "bg-rose-50/70 hover:bg-rose-100/80 border-l-4 border-l-rose-500";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300">Venció hace ${Math.abs(it.dias_restantes)}d</span>`;
      } else if (it.nivel_riesgo === "critico") {
        bgFila = "bg-amber-50/60 hover:bg-amber-100/70 border-l-4 border-l-amber-500";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black border border-amber-300">Quedan ${it.dias_restantes}d</span>`;
      } else if (it.nivel_riesgo === "medio") {
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold border border-blue-200">En ${it.dias_restantes}d</span>`;
      } else {
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium border border-emerald-200">En ${it.dias_restantes}d</span>`;
      }

      const botonStock = it.agotado
        ? `
          <button onclick="ComponenteVencimientos.alternarEstadoAgotado('${it.clave}')" 
                  class="w-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-2xs transition cursor-pointer flex items-center justify-center gap-1">
            ↺ Reingresar a Stock
          </button>
        `
        : `
          <button onclick="ComponenteVencimientos.alternarEstadoAgotado('${it.clave}')" 
                  class="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1">
            ✓ Marcar Agotado / Vendido
          </button>
        `;

      tbody.innerHTML += `
        <tr class="${bgFila} transition border-b border-slate-100">
          <td class="p-3">
            <span class="font-bold text-slate-800 text-xs block leading-tight">${it.descripcion}</span>
          </td>
          <td class="p-3 font-semibold text-slate-600">${it.categoria}</td>
          <td class="p-3 text-center font-mono font-black text-slate-700 bg-slate-100/70 rounded">${it.lote}</td>
          <td class="p-3 text-center font-mono font-bold text-slate-800">
            ${it.cantidad} ud(s)
            <span class="block text-[10px] text-slate-500 font-normal">($${it.inversion_total.toFixed(2)})</span>
          </td>
          <td class="p-3 text-slate-700">
            <span class="font-semibold block truncate max-w-[140px]">${it.proveedor}</span>
            <button onclick="ComponenteVencimientos.verFacturaOrigen(${it.factura_id})" class="text-[11px] text-blue-600 hover:text-blue-800 font-mono font-bold hover:underline cursor-pointer flex items-center gap-1 mt-0.5">
              📄 Fac #${it.factura_num} ↗
            </button>
          </td>
          <td class="p-3 text-center font-mono font-bold text-slate-900">${it.fecha_exp_latam}</td>
          <td class="p-3 text-center">${badgeDias}</td>
          <td class="p-3 text-center">
            ${botonStock}
          </td>
        </tr>
      `;
    });
  },

  verFacturaOrigen(facturaId) {
    const f = state.facturasTodas.find(x => x.id === facturaId);
    if (!f) {
      if (typeof window.mostrarToast === "function") window.mostrarToast("Factura no encontrada en memoria.", "error");
      return;
    }

    const fechaFormat = window.formatearFechaLatam ? window.formatearFechaLatam(f.fecha_emision) : f.fecha_emision;

    document.getElementById("modalVencFacTitulo").innerText = `Factura N° ${f.numero_factura}`;
    document.getElementById("modalVencFacSubtitulo").innerHTML = `Proveedor: <strong>${f.proveedor}</strong> | Emisión: ${fechaFormat} | Estado: <strong>${f.estado_pago || 'Pendiente'}</strong>`;

    const rawUrls = f.url_factura || "";
    const urls = rawUrls.split(',').map(u => u.trim()).filter(u => u.length > 5 && (u.startsWith('http://') || u.startsWith('https://')));
    const enlacesDiv = document.getElementById("modalVencFacEnlaces");
    
    if (urls.length > 0) {
      enlacesDiv.innerHTML = urls.map((u, i) => `
        <a href="${u}" target="_blank" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 shadow-2xs">
          📄 Ver Hoja ${i + 1} ↗
        </a>
      `).join('');
    } else {
      enlacesDiv.innerHTML = `<span class="text-xs text-slate-400 italic">Sin adjunto en la nube.</span>`;
    }

    // Botón para editar directamente la factura en la pantalla dividida de auditoría
    const btnEditarDiv = document.getElementById("modalVencFacBtnEditar");
    if (btnEditarDiv) {
      btnEditarDiv.innerHTML = `
        <button onclick="ComponenteVencimientos.irAEditarFactura(${f.id})" class="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs">
          ✏️ Editar Factura Completa
        </button>
      `;
    }

    const tbody = document.getElementById("modalVencFacItems");
    tbody.innerHTML = "";
    (f.items || []).forEach(it => {
      const cant = it.cantidad || 1;
      const pu = it.precio_unitario || 0;
      const sub = it.precio_total || it.subtotal || (cant * pu);
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="p-2 font-medium text-slate-700">${it.descripcion}</td>
          <td class="p-2 text-center font-mono text-slate-600 font-bold">${it.lote || 'N/A'}</td>
          <td class="p-2 text-center font-mono">${cant}</td>
          <td class="p-2 text-right font-mono">$${parseFloat(pu).toFixed(2)}</td>
          <td class="p-2 text-right font-black font-mono text-slate-900">$${parseFloat(sub).toFixed(2)}</td>
        </tr>
      `;
    });

    document.getElementById("modalVencFacTotal").innerText = `Total Factura: $${parseFloat(f.total || 0).toFixed(2)}`;
    document.getElementById("modalVencFacturaRapida").classList.remove("hidden");
  },

  irAEditarFactura(facturaId) {
    const f = state.facturasTodas.find(x => x.id === facturaId);
    this.cerrarModalFactura();
    if (!f) return;

    if (typeof cambiarTab === "function") {
      cambiarTab("auditoria");
    }

    setTimeout(() => {
      if (window.ComponentePanelEstrategico && typeof ComponentePanelEstrategico.abrirModalVerificacion === "function") {
        ComponentePanelEstrategico.abrirModalVerificacion(f, []);
      }
    }, 150);
  },

  cerrarModalFactura() {
    document.getElementById("modalVencFacturaRapida")?.classList.add("hidden");
  },

  exportarCSV() {
    if (this.itemsCaducidad.length === 0) {
      if (typeof window.mostrarToast === "function") window.mostrarToast("No hay datos de caducidades para exportar.", "warning");
      return;
    }

    const encabezados = ["Producto", "Categoria", "Lote", "Cantidad", "Inversion Total ($)", "Proveedor", "Factura", "Fecha Vencimiento", "Dias Restantes", "Estado Stock"];
    const filas = this.itemsCaducidad.map(it => [
      `"${it.descripcion.replace(/"/g, '""')}"`,
      `"${it.categoria}"`,
      `"${it.lote}"`,
      it.cantidad,
      it.inversion_total.toFixed(2),
      `"${it.proveedor}"`,
      `"${it.factura_num}"`,
      it.fecha_exp_latam,
      it.dias_restantes,
      it.agotado ? "CONSUMIDO/BAJA" : "EN STOCK"
    ]);

    const contenidoCSV = "\uFEFF" + [encabezados.join(";"), ...filas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Caducidades_Mobadent_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.ComponenteVencimientos = ComponenteVencimientos;