const ComponentePanelFacturas = {
  template() {
    return `
      <div class="space-y-4">
        <!-- Semáforo Leyenda -->
        <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5 text-[10px] font-bold">
          <span class="text-slate-400 uppercase tracking-wider block">Auditoría Fiscal en Vivo</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">🔴 Descuadre</span>
            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">🟡 Repetida</span>
            <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">⚪ Cuadre Exacto</span>
          </div>
        </div>

        <!-- KPIs Móviles -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white p-4 rounded-3xl border border-slate-200/70 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gasto Total</span>
            <div id="kpiTotalGastoMovil" class="text-2xl font-black text-slate-900 mt-1 tracking-tight">$0.00</div>
          </div>
          <div class="bg-white p-4 rounded-3xl border border-slate-200/70 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Facturas</span>
            <div id="kpiTotalFacturasMovil" class="text-2xl font-black text-blue-600 mt-1 tracking-tight">0</div>
          </div>
        </div>

        <!-- Buscador Rápido -->
        <div class="relative">
          <input type="text" id="filtroRapidoMovil" oninput="ComponentePanelFacturas.filtrar()" placeholder="Buscar proveedor, N° o producto..." 
                 class="w-full bg-white border border-slate-200/80 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs font-medium placeholder-slate-400">
          <span class="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
        </div>

        <!-- Contenedor de Tarjetas -->
        <div id="contenedorTarjetasFacturas" class="space-y-3"></div>
      </div>

      <!-- MODAL DETALLE DE FACTURA MÓVIL -->
      <div id="modalDetalleMovil" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 max-h-[85vh] flex flex-col">
          <div class="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
            <div>
              <h3 class="text-base font-black text-slate-800" id="mDetalleTitulo">Factura</h3>
              <p class="text-xs text-slate-500" id="mDetalleSubtitulo"></p>
            </div>
            <button onclick="ComponentePanelFacturas.cerrarModal()" class="text-slate-400 text-2xl font-bold p-1 leading-none">&times;</button>
          </div>

          <div id="mDetalleEnlacesHojas" class="mb-3 flex flex-wrap gap-2"></div>

          <div class="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th class="p-2">Insumo</th>
                  <th class="p-2 text-center">Lote/EXP</th>
                  <th class="p-2 text-center">Cant.</th>
                  <th class="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody id="mDetalleItemsBody" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>

          <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span class="text-xs text-slate-500 font-bold">Total Factura:</span>
            <span class="text-lg font-black text-slate-900 font-mono" id="mDetalleTotal">$0.00</span>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    this.renderKPIs(stateMovil.facturas);
    this.renderTarjetas(stateMovil.facturas);
  },

  renderKPIs(facturas) {
    const total = facturas.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
    const kpiG = document.getElementById("kpiTotalGastoMovil");
    const kpiF = document.getElementById("kpiTotalFacturasMovil");
    if (kpiG) kpiG.innerText = `$${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (kpiF) kpiF.innerText = facturas.length;
  },

  filtrar() {
    const q = (document.getElementById("filtroRapidoMovil")?.value || "").toLowerCase().trim();
    const filtradas = stateMovil.facturas.filter(f => {
      if (!q) return true;
      const prov = (f.proveedor || "").toLowerCase();
      const num = String(f.numero_factura || "").toLowerCase();
      const itemsMatch = (f.items || []).some(it => (it.descripcion || "").toLowerCase().includes(q) || (it.lote || "").toLowerCase().includes(q));
      return prov.includes(q) || num.includes(q) || itemsMatch;
    });
    this.renderTarjetas(filtradas);
  },

  renderTarjetas(facturas) {
    const cont = document.getElementById("contenedorTarjetasFacturas");
    if (!cont) return;
    cont.innerHTML = "";

    if (facturas.length === 0) {
      cont.innerHTML = `<div class="bg-white p-6 rounded-3xl border border-slate-200/80 text-center text-xs text-slate-400 font-medium">No se encontraron facturas.</div>`;
      return;
    }

    facturas.forEach(f => {
      // Auditoría Contable Inteligente
      let sumaNeto = 0.0;
      (f.items || []).forEach(it => {
        const cant = parseFloat(it.cantidad) || 0.0;
        const pu = parseFloat(it.precio_unitario) || 0.0;
        const dcto = parseFloat(it.porcentaje_descuento) || 0.0;
        const sub = parseFloat(it.precio_total || (cant * pu * (1 - (dcto / 100.0)))) || 0.0;
        sumaNeto += sub;
      });

      const totOficial = parseFloat(f.total) || 0.0;
      const totalConTodoIva = +(sumaNeto * 1.15).toFixed(2);
      const totalExento = +sumaNeto.toFixed(2);
      const subtotalBd = parseFloat(f.subtotal) || 0.0;
      const impuestosBd = parseFloat(f.impuestos) || 0.0;
      const totalSubtotalMasImpuestos = +(subtotalBd + impuestosBd).toFixed(2);

      const diff1 = Math.abs(totalConTodoIva - totOficial);
      const diff2 = Math.abs(totalExento - totOficial);
      const diff3 = (subtotalBd > 0) ? Math.abs(totalSubtotalMasImpuestos - totOficial) : 999;
      const menorDiff = Math.min(diff1, diff2, diff3);

      const itemsRegistrados = (f.items || []).length;
      const tieneDescuadre = totOficial > 0 && (menorDiff > 0.05 || itemsRegistrados === 0);

      const numLimpio = String(f.numero_factura || "").trim().toLowerCase();
      const esRepetida = Boolean(numLimpio && stateMovil.conteoDuplicados[numLimpio] > 1);

      let bordeSemaf = "border-slate-200/80";
      let bgSemaf = "bg-white";
      let badgeAuditoria = "";

      if (tieneDescuadre) {
        bordeSemaf = "border-rose-400 border-l-4 border-l-rose-500";
        bgSemaf = "bg-rose-50/80";
        let motivo = "";
        if (itemsRegistrados === 0) {
          motivo = `Sin productos registrados (Total: $${totOficial.toFixed(2)})`;
        } else if (sumaNeto < totOficial && totalConTodoIva < totOficial) {
          motivo = `Faltan $${(totOficial - totalConTodoIva).toFixed(2)} (¿Falta otra hoja?)`;
        } else {
          motivo = `Descuadre de $${menorDiff.toFixed(2)} frente al total oficial`;
        }
        badgeAuditoria = `
          <div class="mt-1.5 p-1.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
            ⚠️ ${motivo}
          </div>
        `;
      } else if (esRepetida) {
        bordeSemaf = "border-amber-400 border-l-4 border-l-amber-500";
        bgSemaf = "bg-amber-50/80";
        badgeAuditoria = `
          <div class="mt-1.5 p-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold">
            ⚠️ Factura Repetida (${stateMovil.conteoDuplicados[numLimpio]} veces registrada)
          </div>
        `;
      }

      // Hojas de Supabase
      const rawUrls = f.url_factura || "";
      const urls = rawUrls.split(',').map(u => u.trim()).filter(u => u.length > 5 && (u.startsWith('http://') || u.startsWith('https://')));
      let botonesComprobantes = "";
      if (urls.length === 1) {
        botonesComprobantes = `<a href="${urls[0]}" target="_blank" class="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold border border-blue-200 rounded-xl text-[10px]">📄 Ver</a>`;
      } else if (urls.length > 1) {
        botonesComprobantes = urls.map((u, i) => `
          <a href="${u}" target="_blank" class="px-2 py-1 bg-blue-50 text-blue-700 font-black border border-blue-200 rounded-xl text-[10px]">📄 H${i+1}</a>
        `).join(' ');
      }

      const estaPagado = f.estado_pago === "Pagado";

      const card = document.createElement("div");
      card.className = `${bgSemaf} p-4 rounded-3xl border ${bordeSemaf} shadow-xs space-y-2.5`;
      card.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1">
            <h3 class="font-bold text-slate-900 text-xs leading-snug">${f.proveedor}</h3>
            <p class="text-[11px] text-slate-500 font-mono mt-0.5">#${f.numero_factura} • ${formatearFechaLatam(f.fecha_emision)}</p>
            ${badgeAuditoria}
          </div>
          <button onclick="ComponentePanelFacturas.cambiarPago(${f.id}, '${f.estado_pago}')" 
                  class="px-2.5 py-1 rounded-full text-[10px] font-bold transition active:scale-95 ${
                    estaPagado ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }">
            ${estaPagado ? '✓ Pagado' : '⏳ Pendiente'}
          </button>
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-slate-100">
          <button onclick="ComponentePanelFacturas.abrirModal(${f.id})" class="text-blue-600 font-bold text-xs flex items-center gap-1 active:underline">
            🔍 Ver ${itemsRegistrados} ítem(s) ↗
          </button>
          <span class="text-base font-black text-slate-900 font-mono">$${totOficial.toFixed(2)}</span>
        </div>

        <div class="flex justify-between items-center pt-1 border-t border-slate-100/60">
          <div class="flex items-center gap-1.5">${botonesComprobantes}</div>
          <div class="flex items-center gap-2">
            <button onclick="ComponentePanelFacturas.editarNota(${f.id}, '${(f.comentario || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold">
              💬
            </button>
            <button onclick="ComponentePanelFacturas.eliminar(${f.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
              🗑
            </button>
          </div>
        </div>
      `;
      cont.appendChild(card);
    });
  },

  async cambiarPago(id, estadoActual) {
    const nuevo = estadoActual === "Pagado" ? "Pendiente" : "Pagado";
    await apiMovil.cambiarEstadoPago(id, nuevo);
    const f = stateMovil.facturas.find(x => x.id === id);
    if (f) f.estado_pago = nuevo;
    this.renderTarjetas(stateMovil.facturas);
  },

  async editarNota(id, actual) {
    const nota = prompt("Escribe una nota para esta factura:", actual);
    if (nota === null) return;
    await apiMovil.guardarComentario(id, nota);
    const f = stateMovil.facturas.find(x => x.id === id);
    if (f) f.comentario = nota;
    this.renderTarjetas(stateMovil.facturas);
  },

  async eliminar(id) {
    if (!confirm(`¿Eliminar la factura #${id}? Esta acción no se puede deshacer.`)) return;
    await apiMovil.eliminarFactura(id);
    stateMovil.facturas = stateMovil.facturas.filter(x => x.id !== id);
    this.init();
  },

  abrirModal(facturaId) {
    const f = stateMovil.facturas.find(x => x.id === facturaId);
    if (!f) return;

    document.getElementById("mDetalleTitulo").innerText = `Factura #${f.numero_factura}`;
    document.getElementById("mDetalleSubtitulo").innerText = `${f.proveedor} • ${formatearFechaLatam(f.fecha_emision)}`;
    document.getElementById("mDetalleTotal").innerText = `$${(parseFloat(f.total) || 0).toFixed(2)}`;

    const urls = (f.url_factura || "").split(',').map(u => u.trim()).filter(u => u.length > 5 && (u.startsWith('http://') || u.startsWith('https://')));
    const enlacesDiv = document.getElementById("mDetalleEnlacesHojas");
    if (urls.length > 0) {
      enlacesDiv.innerHTML = urls.map((u, i) => `
        <a href="${u}" target="_blank" class="px-2.5 py-1 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-2xs">
          📄 Abrir Hoja ${i + 1} ↗
        </a>
      `).join(' ');
    } else {
      enlacesDiv.innerHTML = `<span class="text-xs text-slate-400 italic">Sin archivo escaneado.</span>`;
    }

    const tbody = document.getElementById("mDetalleItemsBody");
    tbody.innerHTML = "";
    (f.items || []).forEach(it => {
      const expLatam = formatearFechaLatam(it.fecha_caducidad);
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="p-2 font-medium text-slate-800 text-xs">${it.descripcion}</td>
          <td class="p-2 text-center font-mono text-[10px]">
            <span class="font-bold text-slate-700">${it.lote || 'N/A'}</span>
            <span class="block text-slate-400">${expLatam}</span>
          </td>
          <td class="p-2 text-center font-mono font-bold text-xs">${it.cantidad}</td>
          <td class="p-2 text-right font-mono font-black text-xs">$${(parseFloat(it.precio_total) || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    document.getElementById("modalDetalleMovil")?.classList.remove("hidden");
  },

  cerrarModal() {
    document.getElementById("modalDetalleMovil")?.classList.add("hidden");
  }
};