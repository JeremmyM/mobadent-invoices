const ComponenteHistorialVentas = {
  ventas: [],
  filtroTexto: "",
  filtroMetodo: "todos",
  filtroFecha: "",
  ventaSeleccionadaImpresion: null,

  template() {
    return `
      <div class="space-y-6">
        
        <!-- KPIS FINANCIEROS Y CIERRE DE CAJA -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Ventas Registradas</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-3xl font-black text-slate-800" id="posKpiTotalTickets">0</span>
              <span class="text-xs text-slate-500 font-bold">tickets</span>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ingresos Brutos en Caja</span>
            <span class="text-3xl font-black text-emerald-600 font-mono mt-1 block" id="posKpiMontoTotal">$0.00</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Efectivo Físico</span>
            <span class="text-3xl font-black text-blue-600 font-mono mt-1 block" id="posKpiEfectivo">$0.00</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tarjetas & Banco</span>
            <span class="text-3xl font-black text-purple-600 font-mono mt-1 block" id="posKpiDigitales">$0.00</span>
          </div>
        </div>

        <!-- BARRA DE FILTROS -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-800">Auditoría de Ventas & Transacciones</h2>
              <p class="text-xs text-slate-400">Control de cobros, edición de pagos y anulación con devolución de existencias</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="ComponenteHistorialVentas.exportarCSV()" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer">
                📊 Exportar Excel (CSV)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div class="relative">
              <input type="text" oninput="ComponenteHistorialVentas.filtrarTexto(this.value)" placeholder="Buscar por N° ticket o producto..." 
                     class="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
            </div>

            <div>
              <input type="date" onchange="ComponenteHistorialVentas.filtrarPorFecha(this.value)" 
                     class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <select onchange="ComponenteHistorialVentas.filtrarMetodo(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos los métodos de pago</option>
                <option value="Cash">Solo Efectivo</option>
                <option value="Card">Solo Tarjeta</option>
                <option value="Transfer">Solo Transferencia</option>
              </select>
            </div>
          </div>

          <!-- TABLA DE VENTAS -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs min-w-[850px]">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th class="p-3">Ticket N°</th>
                  <th class="p-3">Fecha & Hora</th>
                  <th class="p-3">Método Pago</th>
                  <th class="p-3 text-center">Uds</th>
                  <th class="p-3 text-right">Subtotal</th>
                  <th class="p-3 text-right font-black text-slate-900">Total Venta</th>
                  <th class="p-3 text-center min-w-[190px]">Acciones</th>
                </tr>
              </thead>
              <tbody id="tbodyHistorialVentas" class="divide-y divide-slate-100 font-medium"></tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- MODAL DETALLE DE TICKET -->
      <div id="modalDetalleTicket" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-800 space-y-4">
          <div class="flex justify-between items-start border-b pb-3">
            <div>
              <h3 class="text-base font-black text-slate-900" id="mTicketNumero">TKT-XXXX</h3>
              <p class="text-xs text-slate-400 font-mono" id="mTicketFecha">2026-10-08</p>
            </div>
            <button onclick="ComponenteHistorialVentas.cerrarModalDetalle()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <div class="overflow-y-auto max-h-56 border rounded-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold">
                <tr>
                  <th class="p-2">Producto</th>
                  <th class="p-2 text-center">Cant.</th>
                  <th class="p-2 text-right">P. Unit</th>
                  <th class="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody id="mTicketItems" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>

          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1 font-mono">
            <div class="flex justify-between text-slate-500">
              <span>Método:</span>
              <span id="mTicketMetodo" class="font-bold text-slate-800">Efectivo</span>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Recibido:</span>
              <span id="mTicketRecibido">$0.00</span>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Vuelto / Cambio:</span>
              <span id="mTicketCambio">$0.00</span>
            </div>
            <div class="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
              <span>Total Pagado:</span>
              <span id="mTicketTotal">$0.00</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button onclick="ComponenteHistorialVentas.imprimirTicket()" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs">
              🖨️ Imprimir Recibo
            </button>
            <button onclick="ComponenteHistorialVentas.cerrarModalDetalle()" class="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL PARA EDITAR VENTA -->
      <div id="modalEditarVenta" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-slate-800 space-y-4">
          <div class="flex justify-between items-center border-b pb-2">
            <h3 class="text-sm font-black text-slate-900">Editar Método y Monto</h3>
            <button onclick="ComponenteHistorialVentas.cerrarModalEditar()" class="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <input type="hidden" id="editVentaId">

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Forma de Pago:</label>
              <select id="editVentaMetodo" class="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500">
                <option value="Cash">Efectivo (Cash)</option>
                <option value="Card">Tarjeta (Card)</option>
                <option value="Transfer">Transferencia (Transfer)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Monto Recibido ($):</label>
              <input type="number" step="0.01" id="editVentaRecibido" class="w-full border border-slate-300 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Vuelto / Cambio ($):</label>
              <input type="number" step="0.01" id="editVentaCambio" class="w-full border border-slate-300 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-100">
            <button onclick="ComponenteHistorialVentas.cerrarModalEditar()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Cancelar</button>
            <button onclick="ComponenteHistorialVentas.guardarEdicionVenta()" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition shadow-xs cursor-pointer">Guardar</button>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    // Si ya tenemos ventas en memoria, mostrarlas de inmediato sin esperar la red
    if (state.ventasPOS && state.ventasPOS.length > 0) {
      this.ventas = state.ventasPOS;
      this.renderKPIs();
      this.renderTabla();
    }

    try {
      const data = await api.getVentasPOS();
      this.ventas = Array.isArray(data) ? data : [];
      state.ventasPOS = this.ventas;
      this.renderKPIs();
      this.renderTabla();
    } catch (e) {
      console.error("Error al sincronizar ventas:", e);
    }
  },

  renderKPIs() {
    let totalBruto = 0, totalEfectivo = 0, totalDigital = 0;

    this.ventas.forEach(v => {
      const tot = parseFloat(v.total) || 0;
      totalBruto += tot;
      if (v.metodo_pago === "Cash") totalEfectivo += tot;
      else totalDigital += tot;
    });

    const elTickets = document.getElementById("posKpiTotalTickets");
    const elBruto = document.getElementById("posKpiMontoTotal");
    const elEfectivo = document.getElementById("posKpiEfectivo");
    const elDigital = document.getElementById("posKpiDigitales");

    if (elTickets) elTickets.innerText = this.ventas.length;
    if (elBruto) elBruto.innerText = `$${totalBruto.toFixed(2)}`;
    if (elEfectivo) elEfectivo.innerText = `$${totalEfectivo.toFixed(2)}`;
    if (elDigital) elDigital.innerText = `$${totalDigital.toFixed(2)}`;
  },

  filtrarTexto(val) {
    this.filtroTexto = (val || "").toLowerCase().trim();
    this.renderTabla();
  },

  filtrarMetodo(val) {
    this.filtroMetodo = val;
    this.renderTabla();
  },

  filtrarPorFecha(val) {
    this.filtroFecha = val;
    this.renderTabla();
  },

  renderTabla() {
    const tbody = document.getElementById("tbodyHistorialVentas");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtradas = this.ventas.filter(v => {
      if (this.filtroMetodo !== "todos" && v.metodo_pago !== this.filtroMetodo) return false;
      if (this.filtroFecha && v.fecha_hora && !v.fecha_hora.startsWith(this.filtroFecha)) return false;
      if (this.filtroTexto) {
        const mTicket = (v.numero_ticket || "").toLowerCase().includes(this.filtroTexto);
        const mItem = (v.items || []).some(i => (i.nombre_producto || "").toLowerCase().includes(this.filtroTexto));
        if (!mTicket && !mItem) return false;
      }
      return true;
    });

    if (filtradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium">No hay tickets coincidentes con los filtros.</td></tr>`;
      return;
    }

    filtradas.forEach(v => {
      let badgeMetodo = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Efectivo</span>`;
      if (v.metodo_pago === "Card") badgeMetodo = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Tarjeta</span>`;
      if (v.metodo_pago === "Transfer") badgeMetodo = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Transf.</span>`;

      const cantItems = (v.items || []).reduce((a, b) => a + (parseFloat(b.cantidad) || 0), 0);
      const subtotal = parseFloat(v.subtotal) || 0;
      const total = parseFloat(v.total) || 0;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-3 font-mono font-bold text-slate-900">${v.numero_ticket}</td>
          <td class="p-3 font-mono text-slate-500">${v.fecha_hora ? v.fecha_hora.replace('T', ' ').slice(0, 16) : 'S/F'}</td>
          <td class="p-3">${badgeMetodo}</td>
          <td class="p-3 text-center font-mono font-bold text-slate-700">${cantItems}</td>
          <td class="p-3 text-right font-mono text-slate-500">$${subtotal.toFixed(2)}</td>
          <td class="p-3 text-right font-mono font-black text-emerald-600 text-sm">$${total.toFixed(2)}</td>
          <td class="p-3 text-center flex items-center justify-center gap-1.5">
            <button onclick="ComponenteHistorialVentas.verDetalle(${v.id})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer" title="Ver detalle">
              👁️ Ver
            </button>
            <button onclick="ComponenteHistorialVentas.abrirModalEditar(${v.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer" title="Editar">
              ✏️ Editar
            </button>
            <button onclick="ComponenteHistorialVentas.anularVenta(${v.id}, '${v.numero_ticket}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer" title="Anular venta">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });
  },

  verDetalle(id) {
    const v = this.ventas.find(x => x.id === id);
    if (!v) return;

    this.ventaSeleccionadaImpresion = v;

    document.getElementById("mTicketNumero").innerText = v.numero_ticket;
    document.getElementById("mTicketFecha").innerText = v.fecha_hora ? v.fecha_hora.replace('T', ' ').slice(0, 19) : '';
    document.getElementById("mTicketMetodo").innerText = v.metodo_pago;
    document.getElementById("mTicketRecibido").innerText = `$${(parseFloat(v.monto_recibido) || 0).toFixed(2)}`;
    document.getElementById("mTicketCambio").innerText = `$${(parseFloat(v.cambio) || 0).toFixed(2)}`;
    document.getElementById("mTicketTotal").innerText = `$${(parseFloat(v.total) || 0).toFixed(2)}`;

    const tbody = document.getElementById("mTicketItems");
    tbody.innerHTML = "";
    (v.items || []).forEach(it => {
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="p-2 font-medium text-slate-800">${it.nombre_producto}</td>
          <td class="p-2 text-center font-mono font-bold text-slate-600">${it.cantidad}</td>
          <td class="p-2 text-right font-mono text-slate-500">$${it.precio_unitario.toFixed(2)}</td>
          <td class="p-2 text-right font-mono font-black text-slate-900">$${it.total.toFixed(2)}</td>
        </tr>
      `;
    });

    document.getElementById("modalDetalleTicket").classList.remove("hidden");
  },

  cerrarModalDetalle() {
    document.getElementById("modalDetalleTicket")?.classList.add("hidden");
  },

  abrirModalEditar(id) {
    const v = this.ventas.find(x => x.id === id);
    if (!v) return;

    document.getElementById("editVentaId").value = v.id;
    document.getElementById("editVentaMetodo").value = v.metodo_pago;
    document.getElementById("editVentaRecibido").value = v.monto_recibido;
    document.getElementById("editVentaCambio").value = v.cambio;

    document.getElementById("modalEditarVenta").classList.remove("hidden");
  },

  cerrarModalEditar() {
    document.getElementById("modalEditarVenta")?.classList.add("hidden");
  },

  async guardarEdicionVenta() {
    const id = document.getElementById("editVentaId").value;
    const metodo = document.getElementById("editVentaMetodo").value;
    const rec = parseFloat(document.getElementById("editVentaRecibido").value) || 0;
    const cambio = parseFloat(document.getElementById("editVentaCambio").value) || 0;

    try {
      await api.editarVentaPOS(id, { metodo_pago: metodo, monto_recibido: rec, cambio: cambio });
      
      // Actualizar en memoria local al instante
      const v = this.ventas.find(x => String(x.id) === String(id));
      if (v) {
        v.metodo_pago = metodo;
        v.monto_recibido = rec;
        v.cambio = cambio;
      }
      this.renderKPIs();
      this.renderTabla();

      if (typeof window.mostrarToast === "function") window.mostrarToast("Venta actualizada correctamente", "success");
      this.cerrarModalEditar();
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  async anularVenta(id, numTicket) {
    const confirmado = await window.confirmarAccion(
      `¿Anular ticket ${numTicket}?`,
      "Las existencias de los productos vendidos se reintegrarán de inmediato al inventario comercial."
    );
    if (!confirmado) return;

    // Actualización optimista: quitar de pantalla de inmediato
    const index = this.ventas.findIndex(x => x.id === id);
    let respaldo = null;
    if (index !== -1) {
      respaldo = this.ventas.splice(index, 1)[0];
      this.renderKPIs();
      this.renderTabla();
    }

    try {
      await api.anularVentaPOS(id, true);
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast(`Ticket ${numTicket} anulado con éxito.`, "info");
      }
      // Actualizar PVP en segundo plano sin congelar la pantalla
      api.getProductosPVP().then(prods => { state.productosPVP = prods; });
    } catch (e) {
      // Revertir en caso de falla de red
      if (respaldo) this.ventas.splice(index, 0, respaldo);
      this.renderKPIs();
      this.renderTabla();
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  imprimirTicket() {
    const v = this.ventaSeleccionadaImpresion;
    if (!v) return;

    const ventana = window.open("", "_blank", "width=320,height=550");
    ventana.document.write(`
      <html>
        <head>
          <title>Recibo - ${v.numero_ticket}</title>
          <style>
            body { font-family: monospace; font-size: 11px; margin: 0; padding: 12px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .linea { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2 style="margin: 0;">MOBADENT</h2>
            <p style="margin: 2px 0;">Comprobante de Venta</p>
            <p style="margin: 2px 0;"><strong>${v.numero_ticket}</strong></p>
            <p style="margin: 2px 0;">${v.fecha_hora ? v.fecha_hora.replace('T', ' ').slice(0, 16) : ''}</p>
          </div>
          <div class="linea"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Cant</th>
                <th style="text-align: left;">Desc</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(v.items || []).map(i => `
                <tr>
                  <td>${i.cantidad}</td>
                  <td>${i.nombre_producto}</td>                   <td class="text-right">$${i.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="linea"></div>
          <div class="text-right">
            <p style="margin: 2px 0;">Subtotal: $${v.subtotal.toFixed(2)}</p>
            <p style="margin: 2px 0;">IVA (15%): $${v.impuestos.toFixed(2)}</p>
            <h3 style="margin: 4px 0;">TOTAL: $${v.total.toFixed(2)}</h3>
            <p style="margin: 2px 0;">Pago (${v.metodo_pago}): $${v.monto_recibido.toFixed(2)}</p>
            <p style="margin: 2px 0;">Cambio: $${v.cambio.toFixed(2)}</p>
          </div>
          <div class="linea"></div>
          <p class="text-center">¡Gracias por su compra!</p>
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
  },

  exportarCSV() {
    if (this.ventas.length === 0) {
      if (typeof window.mostrarToast === "function") window.mostrarToast("No hay ventas para exportar.", "warning");
      return;
    }

    const encabezados = ["Ticket", "Fecha y Hora", "Metodo de Pago", "Subtotal ($)", "Impuestos ($)", "Total ($)", "Monto Recibido ($)", "Cambio ($)"];
    const filas = this.ventas.map(v => [
      `"${v.numero_ticket}"`,
      `"${v.fecha_hora || ''}"`,
      `"${v.metodo_pago}"`,
      v.subtotal.toFixed(2),
      v.impuestos.toFixed(2),
      v.total.toFixed(2),
      v.monto_recibido.toFixed(2),
      v.cambio.toFixed(2)
    ]);

    const csvContent = "\uFEFF" + [encabezados.join(";"), ...filas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Ventas_Mobadent_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.ComponenteHistorialVentas = ComponenteHistorialVentas;