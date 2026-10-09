const ComponenteVencimientosMovil = {
  itemsCaducidad: [],
  filtroRiesgo: "urgentes",
  filtroEstadoStock: "activo",
  filtroTexto: "",

  template() {
    return `
      <div class="space-y-4">
        <!-- KPIs Financieros Móviles -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gradient-to-br from-rose-50 to-white p-3.5 rounded-3xl border border-rose-200 shadow-xs">
            <span class="text-[9px] font-bold text-rose-800 uppercase tracking-wider block">⚠️ Vencidos</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span id="kpiMovilVencidosCant" class="text-2xl font-black text-rose-700">0</span>
              <span class="text-[10px] text-rose-500 font-semibold">lotes</span>
            </div>
            <div id="kpiMovilVencidosDinero" class="mt-1 text-xs font-mono font-black text-rose-700">$0.00</div>
          </div>

          <div class="bg-gradient-to-br from-amber-50 to-white p-3.5 rounded-3xl border border-amber-200 shadow-xs">
            <span class="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">⏳ Crítico (≤ 60d)</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span id="kpiMovilCriticosCant" class="text-2xl font-black text-amber-700">0</span>
              <span class="text-[10px] text-amber-500 font-semibold">lotes</span>
            </div>
            <div id="kpiMovilCriticosDinero" class="mt-1 text-xs font-mono font-black text-amber-700">$0.00</div>
          </div>
        </div>

        <!-- Filtros Rápidos -->
        <div class="space-y-2">
          <div class="relative">
            <input type="text" id="filtroTxtVencMovil" oninput="ComponenteVencimientosMovil.filtrarTexto(this.value)" placeholder="Buscar producto, lote o proveedor..." 
                   class="w-full bg-white border border-slate-200/80 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs font-medium placeholder-slate-400">
            <span class="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <select id="filtroStockMovil" onchange="ComponenteVencimientosMovil.filtrarStock(this.value)" class="bg-white border border-blue-300 text-blue-900 rounded-xl px-2.5 py-2 font-bold focus:ring-2 focus:ring-blue-500 shadow-2xs">
              <option value="activo" selected>🟢 En Stock</option>
              <option value="agotado">⚪ Ya Consumidos</option>
              <option value="todos">📋 Mostrar Todos</option>
            </select>

            <select id="filtroPlazoMovil" onchange="ComponenteVencimientosMovil.filtrarPlazo(this.value)" class="bg-white border border-slate-200/80 text-slate-700 rounded-xl px-2.5 py-2 font-bold focus:ring-2 focus:ring-blue-500 shadow-2xs">
              <option value="urgentes" selected>⚠️ Urgentes (≤60d)</option>
              <option value="todos">Todos los plazos</option>
              <option value="vencidos">🔴 Ya Vencidos</option>
              <option value="medios">🟡 Medio Plazo</option>
              <option value="seguros">🟢 Seguros</option>
            </select>
          </div>
        </div>

        <!-- Lista de Insumos -->
        <div id="contenedorTarjetasVenc" class="space-y-3"></div>
      </div>

      <!-- MODAL RÁPIDO PARA VER COMPROBANTE -->
      <div id="modalVencFacMovil" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-3">
          <div class="flex justify-between items-start border-b border-slate-100 pb-2">
            <div>
              <h3 class="font-black text-slate-900 text-sm" id="mFacTitulo">Factura</h3>
              <p class="text-xs text-slate-500" id="mFacSubtitulo"></p>
            </div>
            <button onclick="ComponenteVencimientosMovil.cerrarModal()" class="text-slate-400 text-xl font-bold">&times;</button>
          </div>
          <div id="mFacEnlaces" class="flex flex-wrap gap-2"></div>
          <div id="mFacTotal" class="text-right text-sm font-black font-mono text-slate-900 pt-2 border-t border-slate-100"></div>
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
    if (agotado) mapa[clave] = true; else delete mapa[clave];
    localStorage.setItem("mobadent_lotes_agotados", JSON.stringify(mapa));
  },

  init() {
    this.procesar();
    this.renderKPIs();
    this.renderTarjetas();
  },

  procesar() {
    this.itemsCaducidad = [];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const hoyTime = new Date(hoyStr).getTime();
    const mapaAgotados = this.getLotesAgotados();

    stateMovil.facturas.forEach(f => {
      (f.items || []).forEach((it, idx) => {
        const expIso = parsearFechaISO(it.fecha_caducidad);
        if (expIso) {
          const expTime = new Date(expIso).getTime();
          const dias = Math.ceil((expTime - hoyTime) / (1000 * 60 * 60 * 24));
          const cant = parseFloat(it.cantidad) || 1;
          const pu = parseFloat(it.precio_unitario) || 0;
          const sub = parseFloat(it.precio_total || (cant * pu)) || 0;

          const claveItem = `f${f.id}_lote_${String(it.lote || 'NA').trim()}_${String(it.descripcion).slice(0, 15)}`;
          const estaAgotado = Boolean(mapaAgotados[claveItem]);

          let nivel = "seguro";
          let accion = "Stock normal";

          if (dias < 0) {
            nivel = "vencido";
            accion = "🚨 Descartar";
          } else if (dias <= 60) {
            nivel = "critico";
            accion = "⚡ Rotar ya";
          } else if (dias <= 180) {
            nivel = "medio";
            accion = "📦 FEFO";
          }

          this.itemsCaducidad.push({
            clave: claveItem,
            descripcion: it.descripcion,
            categoria: it.categoria || "General",
            lote: it.lote || "N/A",
            cantidad: cant,
            inversion: sub,
            proveedor: f.proveedor,
            factura_id: f.id,
            factura_num: f.numero_factura,
            fecha_exp_latam: formatearFechaLatam(expIso),
            dias_restantes: dias,
            nivel,
            accion,
            agotado: estaAgotado
          });
        }
      });
    });

    this.itemsCaducidad.sort((a, b) => a.dias_restantes - b.dias_restantes);
  },

  renderKPIs() {
    let cantV = 0, dinV = 0;
    let cantC = 0, dinC = 0;

    this.itemsCaducidad.forEach(it => {
      if (it.agotado) return;
      if (it.nivel === "vencido") {
        cantV++;
        dinV += it.inversion;
      } else if (it.nivel === "critico") {
        cantC++;
        dinC += it.inversion;
      }
    });

    const elVC = document.getElementById("kpiMovilVencidosCant");
    const elVD = document.getElementById("kpiMovilVencidosDinero");
    const elCC = document.getElementById("kpiMovilCriticosCant");
    const elCD = document.getElementById("kpiMovilCriticosDinero");

    if (elVC) elVC.innerText = cantV;
    if (elVD) elVD.innerText = `$${dinV.toFixed(2)}`;
    if (elCC) elCC.innerText = cantC;
    if (elCD) elCD.innerText = `$${dinC.toFixed(2)}`;
  },

  filtrarTexto(val) {
    this.filtroTexto = (val || "").toLowerCase().trim();
    this.renderTarjetas();
  },

  filtrarStock(val) {
    this.filtroEstadoStock = val;
    this.renderTarjetas();
  },

  filtrarPlazo(val) {
    this.filtroRiesgo = val;
    this.renderTarjetas();
  },

  alternarStock(clave) {
    const it = this.itemsCaducidad.find(x => x.clave === clave);
    if (!it) return;
    it.agotado = !it.agotado;
    this.guardarLoteAgotado(clave, it.agotado);
    this.renderKPIs();
    this.renderTarjetas();
  },

  renderTarjetas() {
    const cont = document.getElementById("contenedorTarjetasVenc");
    if (!cont) return;
    cont.innerHTML = "";

    const filtrados = this.itemsCaducidad.filter(it => {
      if (this.filtroEstadoStock === "activo" && it.agotado) return false;
      if (this.filtroEstadoStock === "agotado" && !it.agotado) return false;

      if (this.filtroRiesgo === "urgentes" && it.nivel !== "vencido" && it.nivel !== "critico") return false;
      if (this.filtroRiesgo === "vencidos" && it.nivel !== "vencido") return false;
      if (this.filtroRiesgo === "medios" && it.nivel !== "medio") return false;
      if (this.filtroRiesgo === "seguros" && it.nivel !== "seguro") return false;

      if (this.filtroTexto) {
        const mDesc = it.descripcion.toLowerCase().includes(this.filtroTexto);
        const mLote = it.lote.toLowerCase().includes(this.filtroTexto);
        const mProv = it.proveedor.toLowerCase().includes(this.filtroTexto);
        if (!mDesc && !mLote && !mProv) return false;
      }
      return true;
    });

    if (filtrados.length === 0) {
      cont.innerHTML = `<div class="bg-white p-6 rounded-3xl border border-slate-200/80 text-center text-xs text-slate-400 font-medium">Sin insumos en este estado.</div>`;
      return;
    }

    filtrados.forEach(it => {
      let badgeDias = "";
      let bgCard = "bg-white";

      if (it.agotado) {
        bgCard = "bg-slate-50 opacity-60";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px]">✓ Consumido / Vendido</span>`;
      } else if (it.nivel === "vencido") {
        bgCard = "bg-rose-50/70 border-l-4 border-l-rose-500";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[9px] border border-rose-300">Venció hace ${Math.abs(it.dias_restantes)}d</span>`;
      } else if (it.nivel === "critico") {
        bgCard = "bg-amber-50/60 border-l-4 border-l-amber-500";
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[9px] border border-amber-300">Quedan ${it.dias_restantes}d</span>`;
      } else {
        badgeDias = `<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium text-[9px] border border-emerald-200">En ${it.dias_restantes}d</span>`;
      }

      const card = document.createElement("div");
      card.className = `${bgCard} p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5`;
      card.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1">
            <h4 class="font-bold text-slate-900 text-xs leading-snug">${it.descripcion}</h4>
            <span class="text-[10px] text-slate-400 font-medium">${it.categoria}</span>
          </div>
          ${badgeDias}
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
          <div>Lote: <strong class="font-mono text-slate-800">${it.lote}</strong></div>
          <div class="text-right">EXP: <strong class="font-mono text-slate-900">${it.fecha_exp_latam}</strong></div>
        </div>

        <div class="flex justify-between items-center text-[11px] text-slate-500 pt-1">
          <span>${it.cantidad} ud(s) <strong class="font-mono text-slate-700 font-bold">($${it.inversion.toFixed(2)})</strong></span>
          <button onclick="ComponenteVencimientosMovil.verFactura(${it.factura_id})" class="text-blue-600 font-mono font-bold underline active:scale-95">
            Fac #${it.factura_num} ↗
          </button>
        </div>

        <div class="pt-2 border-t border-slate-100/70">
          <button onclick="ComponenteVencimientosMovil.alternarStock('${it.clave}')" 
                  class="w-full py-2 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    it.agotado ? 'bg-white border border-slate-300 text-slate-700 shadow-2xs' : 'bg-emerald-600 active:bg-emerald-700 text-white shadow-xs'
                  }">
            ${it.agotado ? '↺ Reingresar a Stock' : '✓ Marcar Agotado / Vendido'}
          </button>
        </div>
      `;
      cont.appendChild(card);
    });
  },

  verFactura(id) {
    const f = stateMovil.facturas.find(x => x.id === id);
    if (!f) return;

    document.getElementById("mFacTitulo").innerText = `Factura #${f.numero_factura}`;
    document.getElementById("mFacSubtitulo").innerText = `${f.proveedor} • ${formatearFechaLatam(f.fecha_emision)}`;
    document.getElementById("mFacTotal").innerText = `Total: $${(parseFloat(f.total) || 0).toFixed(2)}`;

    const urls = (f.url_factura || "").split(',').map(u => u.trim()).filter(u => u.length > 5 && (u.startsWith('http://') || u.startsWith('https://')));
    const enlacesDiv = document.getElementById("mFacEnlaces");
    if (urls.length > 0) {
      enlacesDiv.innerHTML = urls.map((u, i) => `
        <a href="${u}" target="_blank" class="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-2xs">
          📄 Abrir Hoja ${i + 1} ↗
        </a>
      `).join(' ');
    } else {
      enlacesDiv.innerHTML = `<span class="text-xs text-slate-400 italic">Sin comprobante escaneado adjunto.</span>`;
    }

    document.getElementById("modalVencFacMovil")?.classList.remove("hidden");
  },

  cerrarModal() {
    document.getElementById("modalVencFacMovil")?.classList.add("hidden");
  }
};