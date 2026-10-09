const ComponenteTerminalPOS = {
  ticket: [],
  metodoSeleccionado: "Cash",
  sugerenciasFiltradas: [],
  indiceSugerenciaActiva: -1,
  bloqueoCierreRecibo: false,

  template() {
    return `
      <div class="w-full h-full bg-[#181c20] text-slate-100 flex flex-col font-sans select-none overflow-hidden" onclick="ComponenteTerminalPOS.cerrarSugerencias(event)">
        
        <!-- BARRA SUPERIOR DE ENTRADA INTUITIVA CON DROPDOWN EN VIVO -->
        <div class="bg-[#121518] border-b border-slate-800/80 px-4 py-3 flex items-center gap-4 shrink-0 shadow-md relative z-30">
          <div class="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Caja Rápida</span>
          </div>

          <div class="relative flex-1" onclick="event.stopPropagation()">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <span class="text-sm">🔍</span>
            </div>
            
            <input type="text" id="posInputBusqueda" 
                   autocomplete="off"
                   oninput="ComponenteTerminalPOS.onInputBusqueda(this.value)"
                   onkeydown="ComponenteTerminalPOS.manejarKeyBusqueda(event)"
                   placeholder="Escribe el nombre del producto o escanea código de barras..."
                   class="w-full bg-[#20252b] border border-slate-700/80 focus:border-cyan-400 focus:bg-[#262c33] rounded-2xl pl-10 pr-24 py-2.5 text-xs text-white placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition">
            
            <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span class="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold">F3 Buscar</span>
            </div>

            <div id="posDropdownSugerencias" class="hidden absolute left-0 right-0 top-full mt-2 bg-[#1f242b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto z-50 divide-y divide-slate-800"></div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="ComponenteTerminalPOS.limpiarTicket()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer">
              <span>+</span> Nueva Venta (F8)
            </button>
          </div>
        </div>

        <!-- ÁREA CENTRAL DE COBRO -->
        <div class="flex-1 flex overflow-hidden">

          <!-- PANEL IZQUIERDO: TICKET Y PRODUCTOS -->
          <div class="flex-1 flex flex-col border-r border-slate-800/80 bg-[#181c20]">
            
            <div class="grid grid-cols-12 bg-[#121518] border-b border-slate-800/80 py-2.5 px-6 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              <div class="col-span-6">Producto / Ítem</div>
              <div class="col-span-2 text-center">Cantidad</div>
              <div class="col-span-2 text-right">P. Unitario</div>
              <div class="col-span-2 text-right">Total</div>
            </div>

            <div class="flex-1 overflow-y-auto divide-y divide-slate-800/50" id="posTicketLista"></div>

            <div class="bg-[#121518] border-t border-slate-800/80 p-5 shrink-0 flex justify-between items-center">
              <div class="text-xs text-slate-500 font-medium">
                <span>Atajos: </span>
                <span class="text-slate-400 font-mono font-bold">[F3]</span> Buscar • 
                <span class="text-slate-400 font-mono font-bold">[F8]</span> Limpiar • 
                <span class="text-slate-400 font-mono font-bold">[F10]</span> Cobrar
              </div>

              <div class="w-80 space-y-1 text-xs">
                <div class="flex justify-between text-slate-400">
                  <span>Subtotal Neto:</span>
                  <span class="font-mono font-bold" id="posTxtSubtotal">$0.00</span>
                </div>
                <div class="flex justify-between text-slate-400">
                  <span>IVA (15%):</span>
                  <span class="font-mono font-bold" id="posTxtTax">$0.00</span>
                </div>
                <div class="pt-2 border-t border-slate-700/80 flex justify-between items-baseline">
                  <span class="text-sm font-black text-white uppercase tracking-wider">Total a Cobrar</span>
                  <span class="text-3xl font-black text-white font-mono" id="posTxtTotal">$0.00</span>
                </div>
              </div>
            </div>

          </div>

          <!-- PANEL DERECHO: ACCIONES Y COBRO -->
          <div class="w-80 sm:w-96 bg-[#13161a] p-4 flex flex-col justify-between shrink-0 space-y-4">
            
            <div class="grid grid-cols-4 gap-2">
              <button onclick="ComponenteTerminalPOS.eliminarFilaSeleccionada()" class="h-16 bg-[#1f242b] hover:bg-rose-950/40 hover:border-rose-700/50 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-300 font-bold transition cursor-pointer">
                <span class="text-base text-rose-400 font-black">✕</span>
                <span class="text-[10px] mt-0.5">Quitar</span>
              </button>

              <button onclick="document.getElementById('posInputBusqueda').focus()" class="h-16 bg-[#1f242b] hover:bg-slate-700 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-300 font-bold transition relative cursor-pointer">
                <span class="text-[9px] text-cyan-400 absolute top-1.5 right-2 font-mono">F3</span>
                <span class="text-base">🔍</span>
                <span class="text-[10px]">Buscar</span>
              </button>

              <button onclick="ComponenteTerminalPOS.modificarCantidadDialogo()" class="h-16 bg-[#1f242b] hover:bg-slate-700 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-300 font-bold transition relative cursor-pointer">
                <span class="text-[9px] text-cyan-400 absolute top-1.5 right-2 font-mono">F4</span>
                <span class="text-base">🔢</span>
                <span class="text-[10px]">Cantidad</span>
              </button>

              <button onclick="ComponenteTerminalPOS.limpiarTicket()" class="h-16 bg-[#1f242b] hover:bg-slate-700 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-300 font-bold transition relative cursor-pointer">
                <span class="text-[9px] text-cyan-400 absolute top-1.5 right-2 font-mono">F8</span>
                <span class="text-base font-black">+</span>
                <span class="text-[10px]">Nueva</span>
              </button>
            </div>

            <div>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Método de Pago</span>
              <div class="grid grid-cols-3 gap-2">
                <button onclick="ComponenteTerminalPOS.setMetodo('Cash')" id="btnMetodoCash" 
                        class="py-3 rounded-2xl text-xs font-black bg-emerald-600/30 text-emerald-400 border border-emerald-500 transition cursor-pointer">
                  Efectivo
                </button>
                <button onclick="ComponenteTerminalPOS.setMetodo('Card')" id="btnMetodoCard" 
                        class="py-3 rounded-2xl text-xs font-black bg-[#1f242b] text-slate-400 border border-slate-800 transition cursor-pointer">
                  Tarjeta
                </button>
                <button onclick="ComponenteTerminalPOS.setMetodo('Transfer')" id="btnMetodoTransfer" 
                        class="py-3 rounded-2xl text-xs font-black bg-[#1f242b] text-slate-400 border border-slate-800 transition cursor-pointer">
                  Transf.
                </button>
              </div>
            </div>

            <div class="flex-1"></div>

            <div class="space-y-2.5">
              <button onclick="ComponenteTerminalPOS.abrirModalCobro()" 
                      class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center transition shadow-xl shadow-emerald-950 font-black cursor-pointer active:scale-98">
                <span class="text-[11px] text-emerald-200 uppercase font-mono tracking-wider">F10</span>
                <span class="text-xl tracking-tight">Cobrar Venta</span>
              </button>

              <button onclick="ComponenteTerminalPOS.limpiarTicket()" 
                      class="w-full py-2.5 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
                <span>🗑</span> Cancelar Ticket Actual
              </button>
            </div>

          </div>

        </div>

      </div>

      <!-- MODAL DE COBRO Y CAMBIO -->
      <div id="modalPosCobro" class="hidden fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-[#181c20] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 class="text-base font-black text-white">Completar Cobro</h3>
              <p class="text-xs text-slate-400" id="mPosTxtMetodo">Forma de Pago: Efectivo</p>
            </div>
            <button onclick="ComponenteTerminalPOS.cerrarModalCobro()" class="text-slate-400 hover:text-white text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <div class="bg-[#20252b] p-4 rounded-2xl border border-slate-700/80">
            <span class="text-xs font-bold text-slate-400 block mb-0.5">Total a Pagar:</span>
            <span class="text-3xl font-black font-mono text-emerald-400" id="mPosTotalPagar">$0.00</span>
          </div>

          <div class="space-y-1.5 text-xs">
            <label class="block font-bold text-slate-300">Monto Recibido ($):</label>
            <input type="number" step="0.01" id="mPosRecibido" 
                   oninput="ComponenteTerminalPOS.calcularVuelto()" 
                   class="w-full bg-[#20252b] border border-slate-700 rounded-xl p-3 text-xl font-mono font-black text-right text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          </div>

          <div class="p-3.5 bg-[#121518] rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold">Cambio / Vuelto:</span>
            <span class="text-2xl font-mono font-black text-amber-400" id="mPosCambio">$0.00</span>
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-800">
            <button onclick="ComponenteTerminalPOS.cerrarModalCobro()" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer">Cancelar</button>
            <button id="btnConfirmarVentaFinal" onclick="ComponenteTerminalPOS.confirmarVenta()" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer">
              Finalizar Venta (Enter)
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL RECIBO DE CONFIRMACIÓN -->
      <div id="modalReciboExito" class="hidden fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-[#181c20] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-6 text-center text-white space-y-4 shadow-2xl">
          <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl font-black flex items-center justify-center mx-auto border border-emerald-500/40">
            ✓
          </div>
          <div>
            <h3 class="text-lg font-black text-white">¡Venta Exitosa!</h3>
            <p class="text-xs text-slate-400 font-mono" id="reciboNumTicket">TKT-XXXX</p>
          </div>
          <div class="bg-[#20252b] p-4 rounded-2xl border border-slate-700/80 text-left space-y-1.5 text-xs font-mono">
            <div class="flex justify-between text-slate-400">
              <span>Total Pagado:</span>
              <span class="text-white font-bold" id="reciboTotal">$0.00</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Monto Entregado:</span>
              <span class="text-white font-bold" id="reciboRecibido">$0.00</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-700 text-amber-400 font-black text-sm">
              <span>Vuelto / Cambio:</span>
              <span id="reciboCambio">$0.00</span>
            </div>
          </div>
          <button id="btnAceptarRecibo" onclick="ComponenteTerminalPOS.cerrarRecibo()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-lg cursor-pointer">
            Aceptar & Siguiente Venta (Enter)
          </button>
        </div>
      </div>
    `;
  },

  notificar(msg, tipo = "info") {
    if (typeof window.mostrarToast === "function") {
      window.mostrarToast(msg, tipo);
    } else {
      console.log(`[${tipo.toUpperCase()}]: ${msg}`);
    }
  },

  async init() {
    try {
      const pvpActualizado = await api.getProductosPVP();
      state.productosPVP = pvpActualizado || [];
    } catch (e) {
      console.error("Error sincronizando PVP:", e);
    }

    this.renderTicket();
    this.registrarAtajosTeclado();
    setTimeout(() => document.getElementById("posInputBusqueda")?.focus(), 100);
  },

  registrarAtajosTeclado() {
    window.onkeydown = (e) => {
      if (state.tabActiva !== "pos") return;

      const modalExito = document.getElementById("modalReciboExito");
      const modalCobro = document.getElementById("modalPosCobro");

      // Si el recibo está visible, solo permitir cerrar si no está bloqueado por el debouncer
      if (modalExito && !modalExito.classList.contains("hidden")) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          if (!this.bloqueoCierreRecibo) {
            this.cerrarRecibo();
          }
        }
        return;
      }

      // Si está en el modal de cobro y pulsa Enter, confirmar
      if (modalCobro && !modalCobro.classList.contains("hidden")) {
        if (e.key === "Enter") {
          e.preventDefault();
          this.confirmarVenta();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          this.cerrarModalCobro();
          return;
        }
      }

      if (e.key === "F3") {
        e.preventDefault();
        document.getElementById("posInputBusqueda")?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        this.limpiarTicket();
      } else if (e.key === "F10") {
        e.preventDefault();
        this.abrirModalCobro();
      } else if (e.key === "F12") {
        e.preventDefault();
        this.setMetodo("Cash");
      }
    };
  },

  setMetodo(m) {
    this.metodoSeleccionado = m;
    const btnCash = document.getElementById("btnMetodoCash");
    const btnCard = document.getElementById("btnMetodoCard");
    const btnTrans = document.getElementById("btnMetodoTransfer");

    [btnCash, btnCard, btnTrans].forEach(b => {
      if (!b) return;
      b.className = "py-3 rounded-2xl text-xs font-black bg-[#1f242b] text-slate-400 border border-slate-800 transition cursor-pointer";
    });

    if (m === "Cash" && btnCash) btnCash.className = "py-3 rounded-2xl text-xs font-black bg-emerald-600/30 text-emerald-400 border border-emerald-500 transition cursor-pointer";
    if (m === "Card" && btnCard) btnCard.className = "py-3 rounded-2xl text-xs font-black bg-blue-600/30 text-blue-400 border border-blue-500 transition cursor-pointer";
    if (m === "Transfer" && btnTrans) btnTrans.className = "py-3 rounded-2xl text-xs font-black bg-purple-600/30 text-purple-400 border border-purple-500 transition cursor-pointer";
  },

  onInputBusqueda(val) {
    const q = (val || "").trim().toLowerCase();
    const dropdown = document.getElementById("posDropdownSugerencias");
    if (!dropdown) return;

    if (q.length === 0) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
      this.sugerenciasFiltradas = [];
      this.indiceSugerenciaActiva = -1;
      return;
    }

    const prods = (state.productosPVP || []).filter(p => {
      const matchCod = p.codigo_barras && p.codigo_barras.toLowerCase() === q;
      const matchNom = p.nombre.toLowerCase().includes(q);
      return matchCod || matchNom;
    });

    this.sugerenciasFiltradas = prods;
    this.indiceSugerenciaActiva = -1;

    if (prods.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-400">
          No hay coincidencias para "<strong>${val}</strong>"
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = prods.slice(0, 10).map((p, idx) => {
      const stock = parseFloat(p.stock_actual) || 0;
      const sinStock = stock <= 0;
      return `
        <div id="pos-sug-${idx}" onclick="ComponenteTerminalPOS.seleccionarProducto(${p.id})" 
             class="p-3 hover:bg-[#282f38] transition cursor-pointer flex justify-between items-center ${sinStock ? 'opacity-50' : ''}">
          <div>
            <span class="font-bold text-xs text-white block">${p.nombre}</span>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[10px] text-slate-400">${p.categoria || 'General'}</span>
              ${p.codigo_barras ? `<span class="text-[10px] text-cyan-400 font-mono">${p.codigo_barras}</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <span class="font-black font-mono text-emerald-400 text-sm block">$${parseFloat(p.pvp || 0).toFixed(2)}</span>
            <span class="text-[10px] font-bold ${sinStock ? 'text-rose-400' : 'text-slate-400'} font-mono">
              ${sinStock ? 'Agotado (0)' : 'Stock: ' + stock + ' uds'}
            </span>
          </div>
        </div>
      `;
    }).join("");

    dropdown.classList.remove("hidden");
  },

  manejarKeyBusqueda(e) {
    const dropdown = document.getElementById("posDropdownSugerencias");
    const esVisible = dropdown && !dropdown.classList.contains("hidden");

    if (e.key === "ArrowDown") {
      if (!esVisible || this.sugerenciasFiltradas.length === 0) return;
      e.preventDefault();
      this.indiceSugerenciaActiva = Math.min(this.sugerenciasFiltradas.length - 1, this.indiceSugerenciaActiva + 1);
      this.actualizarFocoSugerencia();
    } else if (e.key === "ArrowUp") {
      if (!esVisible || this.sugerenciasFiltradas.length === 0) return;
      e.preventDefault();
      this.indiceSugerenciaActiva = Math.max(0, this.indiceSugerenciaActiva - 1);
      this.actualizarFocoSugerencia();
    } else if (e.key === "Enter") {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;

      if (this.indiceSugerenciaActiva >= 0 && this.sugerenciasFiltradas[this.indiceSugerenciaActiva]) {
        e.preventDefault();
        this.seleccionarProducto(this.sugerenciasFiltradas[this.indiceSugerenciaActiva].id);
        return;
      }

      const porCodigo = (state.productosPVP || []).find(p => p.codigo_barras && p.codigo_barras.toLowerCase() === q);
      if (porCodigo) {
        e.preventDefault();
        this.seleccionarProducto(porCodigo.id);
        return;
      }

      const coincidenciaExacta = (state.productosPVP || []).find(p => p.nombre.toLowerCase() === q);
      if (coincidenciaExacta) {
        e.preventDefault();
        this.seleccionarProducto(coincidenciaExacta.id);
        return;
      }

      if (this.sugerenciasFiltradas.length > 0) {
        e.preventDefault();
        this.seleccionarProducto(this.sugerenciasFiltradas[0].id);
      }
    } else if (e.key === "Escape") {
      this.cerrarSugerencias();
    }
  },

  actualizarFocoSugerencia() {
    this.sugerenciasFiltradas.forEach((_, idx) => {
      const el = document.getElementById(`pos-sug-${idx}`);
      if (!el) return;
      if (idx === this.indiceSugerenciaActiva) {
        el.classList.add("bg-[#2c343e]", "border-l-4", "border-l-cyan-400");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("bg-[#2c343e]", "border-l-4", "border-l-cyan-400");
      }
    });
  },

  seleccionarProducto(id) {
    const prod = (state.productosPVP || []).find(p => p.id === id);
    if (!prod) return;

    this.agregarAlTicket(prod);
    const input = document.getElementById("posInputBusqueda");
    if (input) {
      input.value = "";
      input.focus();
    }
    this.cerrarSugerencias();
  },

  cerrarSugerencias() {
    const dropdown = document.getElementById("posDropdownSugerencias");
    if (dropdown) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
    }
    this.sugerenciasFiltradas = [];
    this.indiceSugerenciaActiva = -1;
  },

  agregarAlTicket(prod) {
    if (parseFloat(prod.stock_actual) <= 0) {
      this.notificar(`"${prod.nombre}" no tiene existencias en stock.`, "error");
      return;
    }

    const itemExistente = this.ticket.find(x => x.id === prod.id);
    if (itemExistente) {
      if (itemExistente.cantidad + 1 > prod.stock_actual) {
        this.notificar(`Stock máximo alcanzado (${prod.stock_actual} uds).`, "warning");
        return;
      }
      itemExistente.cantidad += 1;
      itemExistente.total = +(itemExistente.cantidad * itemExistente.pvp).toFixed(2);
    } else {
      this.ticket.push({
        id: prod.id,
        nombre: prod.nombre,
        cantidad: 1,
        pvp: parseFloat(prod.pvp) || 0,
        total: parseFloat(prod.pvp) || 0,
        stock_max: parseFloat(prod.stock_actual)
      });
    }

    this.renderTicket();
  },

  renderTicket() {
    const contenedor = document.getElementById("posTicketLista");
    if (!contenedor) return;

    if (this.ticket.length === 0) {
      contenedor.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-slate-500 py-32 select-none">
          <span class="text-6xl block mb-3 opacity-20">🛒</span>
          <h4 class="text-base font-bold text-slate-400">Sin productos agregados</h4>
          <p class="text-xs text-slate-500 mt-1">Escribe en el buscador o escanea un código de barras</p>
        </div>
      `;
      this.actualizarTotales(0);
      return;
    }

    contenedor.innerHTML = "";
    let sumaSubtotal = 0;

    this.ticket.forEach((it, idx) => {
      sumaSubtotal += it.total;
      contenedor.innerHTML += `
        <div class="grid grid-cols-12 py-3 px-6 text-xs font-semibold items-center hover:bg-[#20252b]/60 transition">
          <div class="col-span-6 font-bold text-white flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span>${it.nombre}</span>
          </div>
          <div class="col-span-2 text-center font-mono">
            <input type="number" min="1" max="${it.stock_max}" value="${it.cantidad}" 
                   onchange="ComponenteTerminalPOS.cambiarCantidadItem(${idx}, this.value)"
                   class="w-14 bg-slate-800 border border-slate-700 rounded-lg p-1 text-center font-black text-cyan-400 focus:outline-none">
          </div>
          <div class="col-span-2 text-right font-mono text-slate-400">$${it.pvp.toFixed(2)}</div>
          <div class="col-span-2 text-right font-mono font-black text-emerald-400 text-sm">$${it.total.toFixed(2)}</div>
        </div>
      `;
    });

    this.actualizarTotales(sumaSubtotal);
  },

  cambiarCantidadItem(idx, cantVal) {
    const item = this.ticket[idx];
    if (!item) return;

    let c = parseFloat(cantVal) || 1;
    if (c > item.stock_max) {
      this.notificar(`Stock disponible: ${item.stock_max} unidades.`, "warning");
      c = item.stock_max;
    }
    if (c <= 0) c = 1;

    item.cantidad = c;
    item.total = +(c * item.pvp).toFixed(2);
    this.renderTicket();
  },

  actualizarTotales(subtotal) {
    const tax = +(subtotal * 0.15).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);

    const elSub = document.getElementById("posTxtSubtotal");
    const elTax = document.getElementById("posTxtTax");
    const elTot = document.getElementById("posTxtTotal");

    if (elSub) elSub.innerText = `$${subtotal.toFixed(2)}`;
    if (elTax) elTax.innerText = `$${tax.toFixed(2)}`;
    if (elTot) elTot.innerText = `$${total.toFixed(2)}`;
  },

  eliminarFilaSeleccionada() {
    if (this.ticket.length === 0) return;
    const eliminado = this.ticket.pop();
    this.renderTicket();
    this.notificar(`Se quitó "${eliminado.nombre}"`, "info");
  },

  modificarCantidadDialogo() {
    if (this.ticket.length === 0) return;
    const ultimo = this.ticket[this.ticket.length - 1];
    const n = prompt(`Cantidad para "${ultimo.nombre}":`, ultimo.cantidad);
    if (n !== null) {
      this.cambiarCantidadItem(this.ticket.length - 1, n);
    }
  },

  limpiarTicket() {
    this.ticket = [];
    this.renderTicket();
    document.getElementById("posInputBusqueda")?.focus();
  },

  abrirModalCobro() {
    if (this.ticket.length === 0) {
      this.notificar("Agrega al menos un producto antes de cobrar.", "warning");
      return;
    }

    const sub = this.ticket.reduce((a, b) => a + b.total, 0);
    const tot = +(sub * 1.15).toFixed(2);

    document.getElementById("mPosTxtMetodo").innerText = `Forma de Pago: ${this.metodoSeleccionado}`;
    document.getElementById("mPosTotalPagar").innerText = `$${tot.toFixed(2)}`;
    
    const inputRecibido = document.getElementById("mPosRecibido");
    inputRecibido.value = tot.toFixed(2);
    this.calcularVuelto();

    document.getElementById("modalPosCobro").classList.remove("hidden");
    inputRecibido.focus();
    inputRecibido.select();
  },

  cerrarModalCobro() {
    document.getElementById("modalPosCobro")?.classList.add("hidden");
  },

  calcularVuelto() {
    const sub = this.ticket.reduce((a, b) => a + b.total, 0);
    const tot = +(sub * 1.15).toFixed(2);
    const rec = parseFloat(document.getElementById("mPosRecibido").value) || 0;
    const vuelto = Math.max(0, +(rec - tot).toFixed(2));

    document.getElementById("mPosCambio").innerText = `$${vuelto.toFixed(2)}`;
  },

  async confirmarVenta() {
    const sub = this.ticket.reduce((a, b) => a + b.total, 0);
    const tax = +(sub * 0.15).toFixed(2);
    const tot = +(sub + tax).toFixed(2);
    const rec = parseFloat(document.getElementById("mPosRecibido").value) || 0;

    if (rec < tot) {
      this.notificar(`Monto recibido insuficiente ($${rec.toFixed(2)} de $${tot.toFixed(2)}).`, "error");
      return;
    }

    const btn = document.getElementById("btnConfirmarVentaFinal");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Guardando venta...";
    }

    const payload = {
      metodo_pago: this.metodoSeleccionado,
      monto_recibido: rec,
      cambio: +(rec - tot).toFixed(2),
      subtotal: sub,
      impuestos: tax,
      total: tot,
      items: this.ticket.map(t => ({
        producto_id: t.id,
        cantidad: t.cantidad,
        precio_unitario: t.pvp,
        total: t.total
      }))
    };

    try {
      const resp = await api.cobrarPOS(payload);
      
      this.cerrarModalCobro();

      // Configurar el recibo
      document.getElementById("reciboNumTicket").innerText = resp.ticket || "TKT-POS";
      document.getElementById("reciboTotal").innerText = `$${tot.toFixed(2)}`;
      document.getElementById("reciboRecibido").innerText = `$${rec.toFixed(2)}`;
      document.getElementById("reciboCambio").innerText = `$${payload.cambio.toFixed(2)}`;
      
      // Activar bloqueo de medio segundo para evitar cierre involuntario por Enter
      this.bloqueoCierreRecibo = true;
      document.getElementById("modalReciboExito").classList.remove("hidden");
      setTimeout(() => {
        this.bloqueoCierreRecibo = false;
        document.getElementById("btnAceptarRecibo")?.focus();
      }, 500);

      this.limpiarTicket();

      // Recargar catálogo y datos globales
      if (typeof cargarDatosGlobales === "function") {
        await cargarDatosGlobales();
      }

    } catch (e) {
      this.notificar("Error guardando la venta: " + e.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Finalizar Venta (Enter)";
      }
    }
  },

  cerrarRecibo() {
    document.getElementById("modalReciboExito")?.classList.add("hidden");
    document.getElementById("posInputBusqueda")?.focus();
  }
};

window.ComponenteTerminalPOS = ComponenteTerminalPOS;