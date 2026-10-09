const ComponentePanelEstrategico = {
  filtroBusqueda: "",
  filtroProveedor: "todos",
  filtroEstado: "todos",
  filtroMes: "todos",
  archivosSubidosActuales: [],
  datosFacturaEnEdicion: null,
  facturaIdEditando: null,
  impactarStockPVPActivo: true,

  // Visor interactivo (Zoom & Drag)
  visorZoom: 1,
  visorPosX: 0,
  visorPosY: 0,
  visorIsDragging: false,
  visorStartX: 0,
  visorStartY: 0,

  splitterArrastrando: false,

  template() {
    return `
      <div class="space-y-6">

        <!-- 1. KPIS ESTRATÉGICOS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gasto Total Acumulado</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span id="kpiGastoTotal" class="text-3xl font-black text-slate-900 tracking-tight">$0.00</span>
            </div>
            <span class="text-[11px] text-slate-400 font-medium block mt-1">Compras en facturas registradas</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cuentas por Pagar</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span id="kpiPorPagar" class="text-3xl font-black text-rose-600 tracking-tight">$0.00</span>
            </div>
            <span class="text-[11px] text-rose-500 font-bold block mt-1" id="kpiCantPorPagar">0 facturas pendientes</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">IVA Soportado Total</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span id="kpiTotalIva" class="text-3xl font-black text-blue-600 tracking-tight">$0.00</span>
            </div>
            <span class="text-[11px] text-slate-400 font-medium block mt-1">Crédito fiscal deducible</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Promedio de Compra Mensual</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span id="kpiPromedioMensual" class="text-3xl font-black text-purple-600 tracking-tight">$0.00</span>
            </div>
            <span class="text-[11px] text-slate-400 font-medium block mt-1">Flujo de salida recurrente</span>
          </div>
        </div>

        <!-- 2. HERRAMIENTAS Y TABLA DE FACTURAS -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-800">Facturas de Compra & Auditoría Fiscal</h2>
              <p class="text-xs text-slate-400">Verifica comprobantes, edita productos, revisa originales y cuadra pagos</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="ComponentePanelEstrategico.abrirIngresoManualConFoto()" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-slate-300 transition cursor-pointer shadow-2xs">
                <span>✍️</span> Ingreso Manual con Foto
              </button>
              <button onclick="ComponentePanelEstrategico.abrirModalSubida()" class="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer">
                <span>⚡</span> Subir Factura (IA)
              </button>
            </div>
          </div>

          <!-- Filtros -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div class="relative">
              <input type="text" id="filtroTxtAuditoria" oninput="ComponentePanelEstrategico.filtrarTexto(this.value)" placeholder="Buscar por N° factura o proveedor..." 
                     class="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
            </div>

            <div>
              <select id="filtroProvAuditoria" onchange="ComponentePanelEstrategico.filtrarProveedor(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos los proveedores</option>
              </select>
            </div>

            <div>
              <select id="filtroEstadoAuditoria" onchange="ComponentePanelEstrategico.filtrarEstado(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos los estados de pago</option>
                <option value="Pendiente">Solo Pendientes</option>
                <option value="Pagada">Solo Pagadas</option>
              </select>
            </div>

            <div>
              <select id="filtroMesAuditoria" onchange="ComponentePanelEstrategico.filtrarMes(this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos los periodos</option>
              </select>
            </div>
          </div>

          <!-- TABLA -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs min-w-[850px]">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th class="p-3">Factura N°</th>
                  <th class="p-3">Proveedor</th>
                  <th class="p-3">Emisión</th>
                  <th class="p-3 text-center">Estado Pago</th>
                  <th class="p-3 text-right font-black text-slate-900 text-sm">Total Factura</th>
                  <th class="p-3 text-center min-w-[280px]">Opciones & Auditoría</th>
                </tr>
              </thead>
              <tbody id="tbodyAuditoriaFacturas" class="divide-y divide-slate-100 font-medium"></tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- INPUT OCULTO PARA INGRESO MANUAL -->
      <input type="file" id="inputFotoManualDirecta" accept="image/*,application/pdf" class="hidden" onchange="ComponentePanelEstrategico.onFotoManualSeleccionada(this.files)">

      <!-- MODAL 1: SUBIDA RÁPIDA (IA) -->
      <div id="modalSubirFactura" class="hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl max-w-lg w-full p-6 text-slate-800 space-y-4 shadow-2xl border border-slate-100">
          <div class="flex justify-between items-center border-b pb-3">
            <div>
              <h3 class="text-base font-black text-slate-900">Cargar Factura de Compra</h3>
              <p class="text-xs text-slate-400">Sube imágenes o PDF para lectura con IA</p>
            </div>
            <button onclick="ComponentePanelEstrategico.cerrarModalSubida()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <div id="dropzoneFactura" class="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/50 space-y-3">
            <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto font-black">
              📄
            </div>
            <div>
              <p class="text-xs font-bold text-slate-700">Arrastra tus archivos aquí o haz clic para examinar</p>
              <p class="text-[11px] text-slate-400 mt-0.5">Soporta múltiples páginas (PDF, PNG, JPG)</p>
            </div>
            <input type="file" id="inputArchivoFactura" multiple accept="image/*,application/pdf" class="hidden" onchange="ComponentePanelEstrategico.manejarSeleccionArchivos(this.files)">
          </div>

          <div id="listaArchivosSeleccionados" class="space-y-1.5 max-h-32 overflow-y-auto"></div>

          <div id="spinnerExtraccionIA" class="hidden p-4 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-3">
            <span class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"></span>
            <div class="text-xs leading-tight">
              <span class="font-bold block">Extrayendo datos contables con Gemini IA...</span>
              <span class="text-[11px] text-blue-700">Identificando ítems, descuentos, caducidades y subtotales</span>
            </div>
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-100">
            <button onclick="ComponentePanelEstrategico.cerrarModalSubida()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
              Cancelar
            </button>
            <button id="btnIniciarProcesamiento" onclick="ComponentePanelEstrategico.procesarArchivosSubidos()" disabled class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs transition shadow-sm cursor-pointer">
              Procesar con IA
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL 2: VERIFICACIÓN & EDICIÓN DUAL -->
      <div id="modalVerificarFactura" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50">
        <div class="bg-white rounded-3xl w-full max-w-[98vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
          
          <div class="px-6 py-3.5 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
              <div>
                <h3 class="text-sm font-black text-slate-900" id="mVerifTituloPrincipal">Validación Dual & Auditoría de Comprobante</h3>
                <p class="text-[11px] text-slate-400" id="mVerifSubtituloPrincipal">Edita cualquier dato, añade o elimina ítems y revisa el documento original</p>
              </div>
            </div>
            <button onclick="ComponentePanelEstrategico.cerrarModalVerificacion()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <!-- CONTENEDOR FLEX CON SPLITTER MÓVIL (35% VISOR / 65% DATOS) -->
          <div id="contenedorDualDividido" class="flex-1 flex flex-row overflow-hidden relative">
            
            <!-- PANEL IZQUIERDO: VISOR DE DOCUMENTO -->
            <div id="panelIzquierdoVisor" style="width: 35%;" class="bg-slate-900 p-4 flex flex-col justify-between border-r border-slate-800 overflow-hidden relative select-none shrink-0 min-w-[250px] max-w-[65%]">
              
              <div class="absolute top-6 right-6 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl">
                <button onclick="ComponentePanelEstrategico.modificarZoom(0.2)" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition cursor-pointer" title="Acercar (+)">+</button>
                <button onclick="ComponentePanelEstrategico.modificarZoom(-0.2)" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition cursor-pointer" title="Alejar (-)">-</button>
                <button onclick="ComponentePanelEstrategico.resetearVisor()" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer" title="Reiniciar vista">↺</button>
              </div>

              <div id="contenedorVisorDocumento" 
                   class="flex-1 overflow-hidden relative flex items-center justify-center rounded-2xl bg-slate-950/80 shadow-inner cursor-grab active:cursor-grabbing">
                <div id="wrapperImagenInteractivo" class="transition-transform duration-75 origin-center will-change-transform flex items-center justify-center w-full h-full">
                  <div class="text-slate-500 text-xs font-bold">Cargando vista previa del documento...</div>
                </div>
              </div>

              <div class="pt-3 flex justify-between items-center text-[11px] text-slate-400 shrink-0">
                <span id="visorPaginasTexto">Vista original de comprobante</span>
                <span class="text-slate-500 font-mono">Scroll: Zoom • Arrastre: Mover</span>
              </div>
            </div>

            <!-- BARRA DIVISORIA MÓVIL (SPLITTER RESIZER) -->
            <div id="barraDivisoraMover" 
                 class="w-2.5 bg-slate-200 hover:bg-blue-500 active:bg-blue-600 cursor-col-resize flex items-center justify-center transition-colors shrink-0 z-30 select-none group"
                 title="Arrastra para redimensionar los paneles">
              <div class="w-1 h-8 rounded-full bg-slate-400 group-hover:bg-white transition-colors"></div>
            </div>

            <!-- PANEL DERECHO: FORMULARIO MULTI-COLUMNA AMPLIO -->
            <div id="panelDerechoDatos" class="flex-1 bg-white p-5 overflow-y-auto space-y-4 flex flex-col justify-between min-w-[400px]">
              
              <div class="space-y-4">
                
                <!-- ALERTA DE FACTURA DUPLICADA / REPETIDA -->
                <div id="bannerFacturaDuplicada" class="hidden p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs animate-pulse">
                  <div class="flex items-center gap-2.5">
                    <span class="text-lg">⚠️</span>
                    <div>
                      <span class="font-black block text-amber-950" id="bannerDupTitulo">¡Atención! Posible Factura Repetida</span>
                      <span class="text-[11px] text-amber-800" id="bannerDupMensaje">Ya existe una factura registrada con este N° y Proveedor.</span>
                    </div>
                  </div>
                  <button id="btnVerFacturaDuplicada" class="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1">
                    🔍 Ver Factura Existente
                  </button>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div class="sm:col-span-2">
                    <label class="block font-bold text-slate-700 mb-1">Razón Social / Proveedor:</label>
                    <input type="text" id="vFacProveedor" oninput="ComponentePanelEstrategico.verificarFacturaDuplicada()" class="w-full border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">N° Comprobante:</label>
                    <input type="text" id="vFacNumero" oninput="ComponentePanelEstrategico.verificarFacturaDuplicada()" class="w-full border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Fecha Emisión (DD/MM/AAAA):</label>
                    <input type="date" id="vFacFecha" class="w-full border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500">
                  </div>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-black text-slate-800 uppercase tracking-wider">Desglose de Ítems & Medicamentos</span>
                      <span id="vFacBadgeCantidadItems" class="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">0 ítems</span>
                    </div>
                    <button onclick="ComponentePanelEstrategico.agregarFilaItemVerificacion()" class="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer flex items-center gap-1">
                      <span>+</span> Agregar Ítem Manual
                    </button>
                  </div>

                  <!-- TABLA CON COLUMNAS OPTIMIZADAS Y EQUILIBRADAS -->
                  <div class="border rounded-2xl overflow-hidden max-h-[38vh] overflow-x-auto shadow-2xs select-none">
                    <table class="w-full text-left text-xs border-collapse table-fixed" id="tablaItemsVerificacion">
                      <thead class="bg-slate-50 border-b text-slate-600 font-semibold sticky top-0 z-10 text-[11px]">
                        <tr>
                          <th style="width: 32%;" class="p-2 relative border-r border-slate-200">
                            <span class="truncate block">Descripción del Insumo</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 14%;" class="p-2 relative border-r border-slate-200">
                            <span class="truncate block">Categoría</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 8%;" class="p-2 text-center relative border-r border-slate-200">
                            <span class="truncate block">Lote</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 14%;" class="p-2 text-center relative border-r border-slate-200">
                            <span class="truncate block font-bold text-slate-700">Caducidad (EXP)</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 6%;" class="p-2 text-center relative border-r border-slate-200">
                            <span class="truncate block">Cant.</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 10%;" class="p-2 text-right relative border-r border-slate-200">
                            <span class="truncate block font-bold text-slate-700">P. Unit</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 6%;" class="p-2 text-center relative border-r border-slate-200">
                            <span class="truncate block">% Dcto</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 11%;" class="p-2 text-right relative border-r border-slate-200">
                            <span class="truncate block font-bold text-slate-900">Subtotal</span>
                            <div class="col-resizer absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500"></div>
                          </th>
                          <th style="width: 4%;" class="p-2 text-center">✕</th>
                        </tr>
                      </thead>
                      <tbody id="vFacTbodyItems" class="divide-y divide-slate-100 select-auto"></tbody>
                    </table>
                  </div>
                </div>

                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-black text-slate-800">Impacto en Inventario Comercial (PVP)</span>
                      <span id="txtEstadoSwitchPVP" class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ACTIVADO
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-0.5">Suma existencias al stock de ventas y actualiza el Costo Ref. al neto pagado.</p>
                  </div>

                  <button type="button" id="btnTogglePVP" onclick="ComponentePanelEstrategico.alternarSwitchPVP()" 
                          class="relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-emerald-500">
                    <span id="circuloTogglePVP" class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-7"></span>
                  </button>
                </div>

                <!-- ALERTA DISCRETA DE CUADRE MATEMÁTICO AL CENTAVO -->
                <div id="contenedorAlertaMatematica" class="transition-all duration-300 rounded-2xl p-3 border text-xs font-bold flex items-center justify-between">
                  <div class="flex items-center gap-2" id="txtDetalleAlertaMatematica">
                    <span id="iconoAlertaMatematica" class="text-base">✓</span>
                    <span id="mensajeAlertaMatematica">Comprobando cuadre matemático...</span>
                  </div>
                  <span id="badgeDiferenciaCentavos" class="font-mono text-[11px] px-2.5 py-1 rounded-full">Diferencia: $0.00</span>
                </div>

                <!-- Totales Contables -->
                <div class="bg-slate-900 text-white p-4 rounded-2xl grid grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span class="block text-slate-400 text-[10px] uppercase">Suma Ítems Neto:</span>
                    <span id="vFacTxtSubtotal" class="text-base font-bold text-slate-200">$0.00</span>
                  </div>
                  <div>
                    <span class="block text-slate-400 text-[10px] uppercase">IVA Calculado (15%):</span>
                    <span id="vFacTxtIva" class="text-base font-bold text-slate-200">$0.00</span>
                  </div>
                  <div class="text-right">
                    <span class="block text-emerald-400 text-[10px] uppercase font-bold">Total Factura:</span>
                    <div class="flex items-center justify-end gap-1">
                      <span class="text-emerald-400 font-bold">$</span>
                      <input type="number" step="0.01" id="vFacInputTotalFactura" 
                             oninput="ComponentePanelEstrategico.recalcularTotalesVerificacion()"
                             class="w-28 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-right font-mono font-black text-base text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>
                  </div>
                </div>

              </div>

              <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button onclick="ComponentePanelEstrategico.cerrarModalVerificacion()" 
                        class="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all duration-150 cursor-pointer hover:scale-[1.01] active:scale-[0.99]">
                  ✕ Descartar
                </button>
                <button id="btnGuardarFacturaVerificada" onclick="ComponentePanelEstrategico.guardarFacturaVerificada()" 
                        class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-950/20 transition-all duration-150 cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center gap-2">
                  <span class="text-sm">✓</span> Guardar Comprobante
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>

      <!-- MODAL 3: VISTA RÁPIDA DE PRODUCTOS -->
      <div id="modalVistaRapidaProductos" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 text-slate-800 space-y-4">
          <div class="flex justify-between items-start border-b pb-3">
            <div>
              <h3 class="text-base font-black text-slate-900" id="mProdFacTitulo">Insumos de Factura</h3>
              <p class="text-xs text-slate-400 font-mono" id="mProdFacSubtitulo"></p>
            </div>
            <button onclick="ComponentePanelEstrategico.cerrarModalProductos()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none cursor-pointer">&times;</button>
          </div>

          <div class="overflow-y-auto max-h-72 border rounded-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th class="p-2.5">Producto</th>
                  <th class="p-2.5 text-center">Lote</th>
                  <th class="p-2.5 text-center">Caducidad</th>
                  <th class="p-2.5 text-center">Cant.</th>
                  <th class="p-2.5 text-right">P. Unit</th>
                  <th class="p-2.5 text-right font-black">Total</th>
                </tr>
              </thead>
              <tbody id="mProdFacTbody" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>

          <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
            <span class="text-slate-500 font-medium" id="mProdFacCantItems">0 ítems registrados</span>
            <span class="text-slate-900 font-black text-sm font-mono" id="mProdFacTotalMonto">$0.00</span>
          </div>

          <button onclick="ComponentePanelEstrategico.cerrarModalProductos()" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer">
            Cerrar Vista
          </button>
        </div>
      </div>

      <!-- MODAL 4: CONFIRMACIÓN INTELIGENTE DE ELIMINACIÓN -->
      <div id="modalEliminarFacturaOpciones" class="hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 space-y-4 shadow-2xl border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-black mx-auto">
            🗑️
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-base font-black text-slate-900" id="mElimFacTitulo">¿Eliminar Factura?</h3>
            <p class="text-xs text-slate-500 leading-relaxed">
              Selecciona qué deseas hacer con los productos ingresados en el inventario comercial:
            </p>
          </div>

          <div class="space-y-2 pt-2">
            <button onclick="ComponentePanelEstrategico.confirmarEliminarAccion(true)" 
                    class="w-full p-3 rounded-2xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-900 text-left transition cursor-pointer flex items-center justify-between">
              <div>
                <span class="block text-xs font-black">Revertir y Descontar Stock</span>
                <span class="block text-[11px] text-rose-700">Resta las cantidades del inventario comercial PVP</span>
              </div>
              <span class="text-lg">↺</span>
            </button>

            <button onclick="ComponentePanelEstrategico.confirmarEliminarAccion(false)" 
                    class="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left transition cursor-pointer flex items-center justify-between">
              <div>
                <span class="block text-xs font-black">Conservar Stock en Inventario</span>
                <span class="block text-[11px] text-slate-500">Elimina solo el registro contable de la compra</span>
              </div>
              <span class="text-lg">📦</span>
            </button>
          </div>

          <button onclick="ComponentePanelEstrategico.cerrarModalEliminar()" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">
            Cancelar Operación
          </button>
        </div>
      </div>
    `;
  },

  init() {
    this.cargarSelectoresFiltro();
    this.renderKPIs();
    this.renderTabla();
    this.configurarDropzone();
    this.configurarEventosVisorInteractivo();
    this.configurarSplitterDivisor();
    this.configurarColumnasRedimensionables();
  },

  configurarSplitterDivisor() {
    const barra = document.getElementById("barraDivisoraMover");
    const contenedor = document.getElementById("contenedorDualDividido");
    const panelIzq = document.getElementById("panelIzquierdoVisor");

    if (!barra || !contenedor || !panelIzq) return;

    barra.onmousedown = (e) => {
      e.preventDefault();
      this.splitterArrastrando = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    window.addEventListener("mousemove", (e) => {
      if (!this.splitterArrastrando) return;
      const rectContenedor = contenedor.getBoundingClientRect();
      const nuevoAnchoPx = e.clientX - rectContenedor.left;
      const porcentaje = (nuevoAnchoPx / rectContenedor.width) * 100;

      if (porcentaje >= 20 && porcentaje <= 65) {
        panelIzq.style.width = `${porcentaje}%`;
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.splitterArrastrando) {
        this.splitterArrastrando = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  },

  configurarColumnasRedimensionables() {
    const resizers = document.querySelectorAll("#tablaItemsVerificacion .col-resizer");

    resizers.forEach(resizer => {
      const th = resizer.parentElement;

      resizer.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.pageX;
        const startWidth = th.offsetWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMouseMove = (moveEvent) => {
          const diff = moveEvent.pageX - startX;
          const newWidth = Math.max(35, startWidth + diff);
          th.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
    });
  },

  configurarEventosVisorInteractivo() {
    const contenedor = document.getElementById("contenedorVisorDocumento");
    if (!contenedor) return;

    contenedor.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      this.modificarZoom(delta);
    };

    contenedor.onmousedown = (e) => {
      if (e.button !== 0) return;
      this.visorIsDragging = true;
      this.visorStartX = e.clientX - this.visorPosX;
      this.visorStartY = e.clientY - this.visorPosY;
      contenedor.classList.remove("cursor-grab");
      contenedor.classList.add("cursor-grabbing");
    };

    window.addEventListener("mousemove", (e) => {
      if (!this.visorIsDragging) return;
      this.visorPosX = e.clientX - this.visorStartX;
      this.visorPosY = e.clientY - this.visorStartY;
      this.aplicarTransformVisor();
    });

    window.addEventListener("mouseup", () => {
      if (this.visorIsDragging) {
        this.visorIsDragging = false;
        contenedor.classList.remove("cursor-grabbing");
        contenedor.classList.add("cursor-grab");
      }
    });
  },

  modificarZoom(delta) {
    this.visorZoom = Math.min(Math.max(0.5, this.visorZoom + delta), 4.0);
    this.aplicarTransformVisor();
  },

  resetearVisor() {
    this.visorZoom = 1;
    this.visorPosX = 0;
    this.visorPosY = 0;
    this.aplicarTransformVisor();
  },

  aplicarTransformVisor() {
    const wrapper = document.getElementById("wrapperImagenInteractivo");
    if (wrapper) {
      wrapper.style.transform = `translate(${this.visorPosX}px, ${this.visorPosY}px) scale(${this.visorZoom})`;
    }
  },

  cargarSelectoresFiltro() {
    const provs = [...new Set(state.facturasTodas.map(f => f.proveedor).filter(Boolean))].sort();
    const selProv = document.getElementById("filtroProvAuditoria");
    if (selProv) {
      selProv.innerHTML = `<option value="todos">Todos los proveedores</option>` +
        provs.map(p => `<option value="${p}">${p}</option>`).join("");
    }

    const meses = [...new Set(state.facturasTodas.map(f => f.fecha_emision ? f.fecha_emision.slice(0, 7) : "").filter(Boolean))].sort().reverse();
    const selMes = document.getElementById("filtroMesAuditoria");
    if (selMes) {
      selMes.innerHTML = `<option value="todos">Todos los periodos</option>` +
        meses.map(m => `<option value="${m}">${m}</option>`).join("");
    }
  },

  renderKPIs() {
    let gastoTotal = 0, porPagar = 0, cantPorPagar = 0, totalIva = 0;

    state.facturasTodas.forEach(f => {
      const tot = parseFloat(f.total) || 0;
      const iva = parseFloat(f.impuestos) || 0;
      gastoTotal += tot;
      totalIva += iva;

      if (f.estado_pago === "Pendiente") {
        porPagar += tot;
        cantPorPagar++;
      }
    });

    const elGasto = document.getElementById("kpiGastoTotal");
    const elPagar = document.getElementById("kpiPorPagar");
    const elCantPagar = document.getElementById("kpiCantPorPagar");
    const elIva = document.getElementById("kpiTotalIva");
    const elProm = document.getElementById("kpiPromedioMensual");

    if (elGasto) elGasto.innerText = `$${gastoTotal.toFixed(2)}`;
    if (elPagar) elPagar.innerText = `$${porPagar.toFixed(2)}`;
    if (elCantPagar) elCantPagar.innerText = `${cantPorPagar} facturas pendientes`;
    if (elIva) elIva.innerText = `$${totalIva.toFixed(2)}`;
    if (elProm) elProm.innerText = `$${(state.flujoCaja.promedio_mensual || 0).toFixed(2)}`;
  },

  filtrarTexto(val) {
    this.filtroBusqueda = (val || "").toLowerCase().trim();
    this.renderTabla();
  },

  filtrarProveedor(val) {
    this.filtroProveedor = val;
    this.renderTabla();
  },

  filtrarEstado(val) {
    this.filtroEstado = val;
    this.renderTabla();
  },

  filtrarMes(val) {
    this.filtroMes = val;
    this.renderTabla();
  },

  renderTabla() {
    const tbody = document.getElementById("tbodyAuditoriaFacturas");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtradas = state.facturasTodas.filter(f => {
      if (this.filtroProveedor !== "todos" && f.proveedor !== this.filtroProveedor) return false;
      if (this.filtroEstado !== "todos" && f.estado_pago !== this.filtroEstado) return false;
      if (this.filtroMes !== "todos" && f.fecha_emision && !f.fecha_emision.startsWith(this.filtroMes)) return false;

      if (this.filtroBusqueda) {
        const mNum = (f.numero_factura || "").toLowerCase().includes(this.filtroBusqueda);
        const mProv = (f.proveedor || "").toLowerCase().includes(this.filtroBusqueda);
        if (!mNum && !mProv) return false;
      }
      return true;
    });

    if (filtradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">No hay facturas coincidentes con los filtros.</td></tr>`;
      return;
    }

    filtradas.forEach(f => {
      const esPendiente = f.estado_pago === "Pendiente";
      
      const badgeEstado = esPendiente
        ? `<button onclick="ComponentePanelEstrategico.alternarEstadoPago(${f.id}, '${f.estado_pago}')" 
                   title="Click para marcar como PAGADA"
                   class="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 transition cursor-pointer shadow-2xs">
             ⏳ Pendiente
           </button>`
        : `<button onclick="ComponentePanelEstrategico.alternarEstadoPago(${f.id}, '${f.estado_pago}')" 
                   title="Click para marcar como PENDIENTE"
                   class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition cursor-pointer shadow-2xs">
             ✓ Pagada
           </button>`;

      const rawUrls = f.url_factura || "";
      const urls = rawUrls.split(',').map(u => u.trim()).filter(u => u.startsWith('http://') || u.startsWith('https://'));
      
      const botonArchivo = urls.length > 0
        ? `<a href="${urls[0]}" target="_blank" class="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Ver comprobante en la nube">
            📄 Doc ↗
           </a>`
        : `<span class="text-[10px] text-slate-400 italic">Sin adjunto</span>`;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-3 font-mono font-bold text-slate-900">#${f.numero_factura}</td>
          <td class="p-3 font-bold text-slate-800">${f.proveedor}</td>
          <td class="p-3 font-mono text-slate-500">${window.formatearFechaLatam ? window.formatearFechaLatam(f.fecha_emision) : (f.fecha_emision || 'S/F')}</td>
          <td class="p-3 text-center">${badgeEstado}</td>
          <td class="p-3 text-right font-mono font-black text-emerald-600 text-sm">$${(f.total || 0).toFixed(2)}</td>
          <td class="p-3 text-center flex items-center justify-center gap-1.5 flex-wrap">
            <button onclick="ComponentePanelEstrategico.verProductosFactura(${f.id})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs" title="Ver lista de productos comprados">
              📦 Ver Productos
            </button>
            <button onclick="ComponentePanelEstrategico.editarFactura(${f.id})" class="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs" title="Editar ítems y datos en vista dual">
              ✏️ Editar
            </button>
            ${botonArchivo}
            <button onclick="ComponentePanelEstrategico.solicitarEliminarFactura(${f.id}, '${f.numero_factura}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer" title="Eliminar comprobante">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });
  },

  verProductosFactura(id) {
    const f = state.facturasTodas.find(x => x.id === id);
    if (!f) return;

    const fechaFmt = window.formatearFechaLatam ? window.formatearFechaLatam(f.fecha_emision) : (f.fecha_emision || 'S/F');
    document.getElementById("mProdFacTitulo").innerText = `Factura #${f.numero_factura}`;
    document.getElementById("mProdFacSubtitulo").innerText = `Proveedor: ${f.proveedor} | Emisión: ${fechaFmt}`;
    
    const tbody = document.getElementById("mProdFacTbody");
    tbody.innerHTML = "";

    const items = f.items || [];
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Sin productos registrados en esta factura.</td></tr>`;
    } else {
      items.forEach(it => {
        const cant = parseFloat(it.cantidad) || 1;
        const pu = parseFloat(it.precio_unitario) || 0;
        const tot = parseFloat(it.precio_total) || (cant * pu);
        const cad = window.formatearFechaLatam ? window.formatearFechaLatam(it.fecha_caducidad) : (it.fecha_caducidad || "S/F");

        tbody.innerHTML += `
          <tr class="hover:bg-slate-50">
            <td class="p-2.5 font-bold text-slate-800">${it.descripcion}</td>
            <td class="p-2.5 text-center font-mono text-slate-600">${it.lote || 'N/A'}</td>
            <td class="p-2.5 text-center font-mono font-bold text-slate-700">${cad}</td>
            <td class="p-2.5 text-center font-mono">${cant}</td>
            <td class="p-2.5 text-right font-mono text-slate-500">$${pu.toFixed(2)}</td>
            <td class="p-2.5 text-right font-mono font-black text-slate-900">$${tot.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    document.getElementById("mProdFacCantItems").innerText = `${items.length} productos registrados`;
    document.getElementById("mProdFacTotalMonto").innerText = `Total: $${(f.total || 0).toFixed(2)}`;
    document.getElementById("modalVistaRapidaProductos")?.classList.remove("hidden");
  },

  cerrarModalProductos() {
    document.getElementById("modalVistaRapidaProductos")?.classList.add("hidden");
  },

  alternarSwitchPVP() {
    this.impactarStockPVPActivo = !this.impactarStockPVPActivo;
    const btn = document.getElementById("btnTogglePVP");
    const circulo = document.getElementById("circuloTogglePVP");
    const txt = document.getElementById("txtEstadoSwitchPVP");

    if (this.impactarStockPVPActivo) {
      btn.className = "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-emerald-500";
      circulo.className = "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-7";
      txt.className = "text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
      txt.innerText = "ACTIVADO";
    } else {
      btn.className = "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-slate-300";
      circulo.className = "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-0";
      txt.className = "text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 border border-slate-300";
      txt.innerText = "APAGADO";
    }
  },

  abrirIngresoManualConFoto() {
    const input = document.getElementById("inputFotoManualDirecta");
    if (input) {
      input.value = "";
      input.click();
    }
  },

  onFotoManualSeleccionada(files) {
    if (!files || files.length === 0) return;
    this.archivosSubidosActuales = Array.from(files);
    this.facturaIdEditando = null;

    this.abrirModalVerificacion({
      proveedor: "",
      numero_factura: "",
      fecha_emision: new Date().toISOString().slice(0, 10),
      estado_pago: "Pendiente",
      total: 0,
      subtotal: 0,
      impuestos: 0,
      items: []
    }, this.archivosSubidosActuales);
  },

  abrirModalSubida() {
    this.archivosSubidosActuales = [];
    const inp = document.getElementById("inputArchivoFactura");
    if (inp) inp.value = "";
    document.getElementById("listaArchivosSeleccionados").innerHTML = "";
    document.getElementById("btnIniciarProcesamiento").disabled = true;
    document.getElementById("spinnerExtraccionIA").classList.add("hidden");
    document.getElementById("modalSubirFactura")?.classList.remove("hidden");
  },

  cerrarModalSubida() {
    document.getElementById("modalSubirFactura")?.classList.add("hidden");
  },

  configurarDropzone() {
    const dz = document.getElementById("dropzoneFactura");
    if (!dz) return;

    dz.onclick = () => document.getElementById("inputArchivoFactura")?.click();
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("border-blue-500", "bg-blue-50/40"); };
    dz.ondragleave = () => { dz.classList.remove("border-blue-500", "bg-blue-50/40"); };
    dz.ondrop = (e) => {
      e.preventDefault();
      dz.classList.remove("border-blue-500", "bg-blue-50/40");
      if (e.dataTransfer.files?.length) {
        this.manejarSeleccionArchivos(e.dataTransfer.files);
      }
    };
  },

  manejarSeleccionArchivos(files) {
    if (!files || files.length === 0) return;
    this.archivosSubidosActuales = Array.from(files);

    const lista = document.getElementById("listaArchivosSeleccionados");
    lista.innerHTML = this.archivosSubidosActuales.map(f => `
      <div class="flex justify-between items-center bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
        <span class="truncate max-w-[280px]">📄 ${f.name}</span>
        <span class="text-[10px] text-slate-400 font-mono">${(f.size / 1024).toFixed(0)} KB</span>
      </div>
    `).join("");

    document.getElementById("btnIniciarProcesamiento").disabled = false;
  },

  async procesarArchivosSubidos() {
    if (this.archivosSubidosActuales.length === 0) return;

    const spinner = document.getElementById("spinnerExtraccionIA");
    const btn = document.getElementById("btnIniciarProcesamiento");
    spinner.classList.remove("hidden");
    btn.disabled = true;

    try {
      const resultado = await api.extraerFacturaIA(this.archivosSubidosActuales);
      this.cerrarModalSubida();
      this.facturaIdEditando = null;
      this.abrirModalVerificacion(resultado, this.archivosSubidosActuales);
    } catch (error) {
      console.warn("Fallo en extracción IA:", error);
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("No se pudo extraer automáticamente. Abriendo verificación manual con el documento.", "warning");
      }

      this.cerrarModalSubida();
      this.facturaIdEditando = null;
      this.abrirModalVerificacion({
        proveedor: "",
        numero_factura: "",
        fecha_emision: new Date().toISOString().slice(0, 10),
        estado_pago: "Pendiente",
        total: 0,
        subtotal: 0,
        impuestos: 0,
        items: []
      }, this.archivosSubidosActuales);
    } finally {
      spinner.classList.add("hidden");
      btn.disabled = false;
    }
  },

  editarFactura(id) {
    const f = state.facturasTodas.find(x => x.id === id);
    if (!f) return;

    this.facturaIdEditando = f.id;
    this.archivosSubidosActuales = [];

    const datos = {
      proveedor: f.proveedor,
      numero_factura: f.numero_factura,
      fecha_emision: f.fecha_emision,
      estado_pago: f.estado_pago,
      total: f.total,
      url_factura: f.url_factura,
      items: (f.items || []).map(it => ({
        descripcion: it.descripcion,
        categoria: it.categoria || "General",
        lote: it.lote || "N/A",
        fecha_caducidad: it.fecha_caducidad,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        porcentaje_descuento: it.porcentaje_descuento || 0,
        precio_total: it.precio_total
      }))
    };

    this.abrirModalVerificacion(datos, []);
  },

  abrirModalVerificacion(datos, archivos) {
    this.datosFacturaEnEdicion = datos || {};
    this.resetearVisor();

    const tit = document.getElementById("mVerifTituloPrincipal");
    const sub = document.getElementById("mVerifSubtituloPrincipal");
    if (this.facturaIdEditando) {
      if (tit) tit.innerText = `Editando Factura #${datos.numero_factura || ''}`;
      if (sub) sub.innerText = "Modifica ítems, precios o retenciones. Se actualizará en la base de datos.";
    } else {
      if (tit) tit.innerText = "Validación Dual & Auditoría de Comprobante";
      if (sub) sub.innerText = "Verifica cantidades, descuentos, caducidades y el cuadre matemático al centavo.";
    }

    const wrapper = document.getElementById("wrapperImagenInteractivo");
    if (wrapper) {
      if (archivos && archivos.length > 0) {
        const primerArchivo = archivos[0];
        const urlBlob = URL.createObjectURL(primerArchivo);

        if (primerArchivo.type === "application/pdf") {
          wrapper.innerHTML = `<embed src="${urlBlob}" type="application/pdf" class="w-full h-full rounded-xl pointer-events-auto" />`;
        } else {
          wrapper.innerHTML = `<img src="${urlBlob}" alt="Comprobante" draggable="false" class="max-h-full max-w-full object-contain rounded-xl shadow-md pointer-events-none" />`;
        }
      } else if (datos.url_factura) {
        const urls = datos.url_factura.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
        if (urls.length > 0) {
          const u = urls[0];
          if (u.toLowerCase().endsWith('.pdf')) {
            wrapper.innerHTML = `<embed src="${u}" type="application/pdf" class="w-full h-full rounded-xl pointer-events-auto" />`;
          } else {
            wrapper.innerHTML = `<img src="${u}" alt="Factura Nube" draggable="false" class="max-h-full max-w-full object-contain rounded-xl shadow-md pointer-events-none" />`;
          }
        } else {
          wrapper.innerHTML = `<div class="text-slate-500 text-xs font-bold">Sin archivo digital adjunto en la nube.</div>`;
        }
      } else {
        wrapper.innerHTML = `<div class="text-slate-500 text-xs font-bold">No se cargó archivo físico para esta factura.</div>`;
      }
    }

    document.getElementById("vFacProveedor").value = datos.proveedor || "";
    document.getElementById("vFacNumero").value = datos.numero_factura || "";
    
    // Parseo estricto de fecha latinoamericana DD/MM/YYYY hacia ISO YYYY-MM-DD
    const fechaLimpia = window.parsearFechaISO ? window.parsearFechaISO(datos.fecha_emision) : (datos.fecha_emision ? datos.fecha_emision.slice(0, 10) : "");
    document.getElementById("vFacFecha").value = fechaLimpia || new Date().toISOString().slice(0, 10);
    
    const inpTotal = document.getElementById("vFacInputTotalFactura");
    if (inpTotal) {
      inpTotal.value = (parseFloat(datos.total) || 0).toFixed(2);
    }

    this.renderItemsVerificacion(datos.items || []);
    document.getElementById("modalVerificarFactura")?.classList.remove("hidden");

    // Verificar si la factura ya existe en memoria y mostrar alerta
    this.verificarFacturaDuplicada();

    setTimeout(() => this.configurarColumnasRedimensionables(), 100);
  },

  // -----------------------------------------------------------
  // DETECCIÓN INTELIGENTE DE FACTURAS DUPLICADAS / REPETIDAS
  // -----------------------------------------------------------
  verificarFacturaDuplicada() {
    const banner = document.getElementById("bannerFacturaDuplicada");
    if (!banner) return;

    const numIngresado = (document.getElementById("vFacNumero")?.value || "").trim().toLowerCase();
    const provIngresado = (document.getElementById("vFacProveedor")?.value || "").trim().toLowerCase();

    // Si faltan datos o estamos editando una factura existente con el mismo ID, ocultar
    if (!numIngresado || !provIngresado) {
      banner.classList.add("hidden");
      return;
    }

    const facturaExistente = state.facturasTodas.find(f => {
      if (this.facturaIdEditando && f.id === this.facturaIdEditando) return false;
      const mismoNum = String(f.numero_factura || "").trim().toLowerCase() === numIngresado;
      const mismoProv = String(f.proveedor || "").trim().toLowerCase().includes(provIngresado) || provIngresado.includes(String(f.proveedor || "").trim().toLowerCase());
      return mismoNum && mismoProv;
    });

    if (facturaExistente) {
      const msg = document.getElementById("bannerDupMensaje");
      const btnVer = document.getElementById("btnVerFacturaDuplicada");
      if (msg) {
        msg.innerHTML = `La factura <strong>#${facturaExistente.numero_factura}</strong> de <strong>${facturaExistente.proveedor}</strong> ya fue registrada el <strong>${window.formatearFechaLatam(facturaExistente.fecha_emision)}</strong> por un total de <strong>$${(facturaExistente.total || 0).toFixed(2)}</strong>.`;
      }
      if (btnVer) {
        btnVer.onclick = () => {
          this.verProductosFactura(facturaExistente.id);
        };
      }
      banner.classList.remove("hidden");
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast(`⚠️ Alerta: Factura #${facturaExistente.numero_factura} ya registrada.`, "warning");
      }
    } else {
      banner.classList.add("hidden");
    }
  },

  cerrarModalVerificacion() {
    document.getElementById("modalVerificarFactura")?.classList.add("hidden");
    this.facturaIdEditando = null;
  },

  renderItemsVerificacion(items) {
    const tbody = document.getElementById("vFacTbodyItems");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!items || items.length === 0) {
      this.agregarFilaItemVerificacion();
      return;
    }

    items.forEach(it => {
      this.agregarFilaItemVerificacion(it);
    });

    this.recalcularTotalesVerificacion();
  },

  agregarFilaItemVerificacion(it = null) {
    const tbody = document.getElementById("vFacTbodyItems");
    if (!tbody) return;

    const categoriasClinicas = [
      "General", "Restauración & Estética", "Endodoncia", "Ortodoncia",
      "Periodoncia & Profilaxis", "Impresión & Modelos", "Prótesis & Laboratorio",
      "Instrumental & Fresas", "Bioseguridad & Esterilización", "Equipos & Repuestos", "Gasto Operativo"
    ];

    const desc = it ? (it.descripcion || "") : "";
    const catSel = it ? (it.categoria || "General") : "General";
    const lote = it ? (it.lote || "N/A") : "N/A";
    
    // Parseo exacto de caducidad DD/MM/YYYY
    const rawCad = it ? (it.fecha_caducidad || it.caducidad || "") : "";
    const cadVal = window.parsearFechaISO ? (window.parsearFechaISO(rawCad) || "") : (rawCad ? rawCad.slice(0, 10) : "");

    const cant = it ? (parseFloat(it.cantidad) || 1) : 1;
    const pu = it ? (parseFloat(it.precio_unitario) || 0) : 0;
    const dcto = it ? (parseFloat(it.porcentaje_descuento || it.descuento) || 0) : 0;
    
    const factorDcto = 1.0 - (dcto / 100.0);
    const tot = it ? (parseFloat(it.precio_total || it.total) || (cant * pu * factorDcto)) : (cant * pu * factorDcto);

    const opcionesCategorias = categoriasClinicas.map(c => 
      `<option value="${c}" ${c === catSel ? 'selected' : ''}>${c}</option>`
    ).join("");

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <!-- Descripción compacta pero legible -->
      <td class="p-1">
        <input type="text" value="${desc}" placeholder="Nombre del insumo..." 
               class="item-desc w-full border border-slate-200 rounded-lg py-1 px-2 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs">
      </td>
      <!-- Categoría truncada con letra pequeña -->
      <td class="p-1">
        <select class="item-cat w-full border border-slate-200 rounded-lg py-1 px-1.5 bg-slate-50 font-bold text-slate-700 focus:outline-none text-[10px] truncate">
          ${opcionesCategorias}
        </select>
      </td>
      <!-- Lote monoespaciado -->
      <td class="p-1 text-center">
        <input type="text" value="${lote}" placeholder="Lote" 
               class="item-lote w-full border border-slate-200 rounded-lg py-1 px-1 text-center font-mono text-slate-600 focus:outline-none text-xs">
      </td>
      <!-- Caducidad con ancho exacto para ver año-mes-día -->
      <td class="p-1 text-center">
        <input type="date" value="${cadVal}" title="Fecha de caducidad"
               class="item-cad w-full border border-slate-200 rounded-lg py-1 px-1.5 text-center font-mono text-slate-700 font-bold focus:outline-none text-xs bg-slate-50/40">
      </td>
      <!-- Cantidad numérica -->
      <td class="p-1 text-center">
        <input type="number" step="1" value="${cant}" oninput="ComponentePanelEstrategico.recalcularFila(this)" 
               class="item-cant w-full border border-slate-200 rounded-lg py-1 px-1 text-center font-mono font-bold focus:outline-none text-xs">
      </td>
      <!-- Precio Unitario nítido -->
      <td class="p-1 text-right">
        <input type="number" step="0.01" value="${pu.toFixed(2)}" oninput="ComponentePanelEstrategico.recalcularFila(this)" 
               class="item-pu w-full border border-slate-200 rounded-lg py-1 px-1.5 text-right font-mono font-bold text-slate-800 focus:outline-none text-xs">
      </td>
      <!-- Porcentaje Descuento -->
      <td class="p-1 text-center">
        <input type="number" step="1" min="0" max="100" value="${dcto}" oninput="ComponentePanelEstrategico.recalcularFila(this)" 
               class="item-dcto w-full border border-slate-200 rounded-lg py-1 px-1 text-center font-mono font-bold text-amber-600 focus:outline-none text-xs">
      </td>
      <!-- Subtotal nítido y destacado -->
      <td class="p-1 text-right">
        <input type="number" step="0.01" value="${tot.toFixed(2)}" readonly 
               class="item-tot w-full bg-slate-50 border border-slate-200 rounded-lg py-1 px-1.5 text-right font-mono font-black text-slate-900 focus:outline-none text-xs">
      </td>
      <td class="p-1 text-center">
        <button onclick="this.closest('tr').remove(); ComponentePanelEstrategico.recalcularTotalesVerificacion();" class="text-rose-500 font-bold hover:text-rose-700 cursor-pointer text-sm">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
    this.recalcularTotalesVerificacion();
  },

  recalcularFila(input) {
    const tr = input.closest("tr");
    const cant = parseFloat(tr.querySelector(".item-cant").value) || 0;
    const pu = parseFloat(tr.querySelector(".item-pu").value) || 0;
    const dcto = parseFloat(tr.querySelector(".item-dcto").value) || 0;
    
    const factorDcto = 1.0 - (dcto / 100.0);
    const subtotalFila = +(cant * pu * factorDcto).toFixed(2);

    const totInput = tr.querySelector(".item-tot");
    totInput.value = subtotalFila.toFixed(2);

    this.recalcularTotalesVerificacion();
  },

  recalcularTotalesVerificacion() {
    const filas = document.querySelectorAll("#vFacTbodyItems tr");
    let sumaItemsNeto = 0;

    filas.forEach(tr => {
      const tot = parseFloat(tr.querySelector(".item-tot")?.value) || 0;
      sumaItemsNeto += tot;
    });

    const ivaCalculado = +(sumaItemsNeto * 0.15).toFixed(2);
    const totalEstimado = +(sumaItemsNeto + ivaCalculado).toFixed(2);

    const inpTotal = document.getElementById("vFacInputTotalFactura");
    let totalFacturaReal = parseFloat(inpTotal?.value) || 0;

    if (totalFacturaReal === 0 && totalEstimado > 0) {
      totalFacturaReal = totalEstimado;
      if (inpTotal) inpTotal.value = totalFacturaReal.toFixed(2);
    }

    document.getElementById("vFacTxtSubtotal").innerText = `$${sumaItemsNeto.toFixed(2)}`;
    document.getElementById("vFacTxtIva").innerText = `$${ivaCalculado.toFixed(2)}`;

    const badgeCant = document.getElementById("vFacBadgeCantidadItems");
    if (badgeCant) badgeCant.innerText = `${filas.length} ítems`;

    // VERIFICACIÓN MATEMÁTICA AL CENTAVO
    const contenedorAlerta = document.getElementById("contenedorAlertaMatematica");
    const icono = document.getElementById("iconoAlertaMatematica");
    const mensaje = document.getElementById("mensajeAlertaMatematica");
    const badgeDif = document.getElementById("badgeDiferenciaCentavos");

    const diferencia = +(totalFacturaReal - totalEstimado).toFixed(2);

    if (Math.abs(diferencia) <= 0.01) {
      contenedorAlerta.className = "rounded-2xl p-3 border text-xs font-bold flex items-center justify-between bg-emerald-50 border-emerald-300 text-emerald-900";
      icono.innerText = "✓";
      icono.className = "text-base text-emerald-600";
      mensaje.innerText = "Matemática Cuadrada al centavo con el Total de Factura";
      badgeDif.className = "font-mono text-[11px] px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900 font-black";
      badgeDif.innerText = "Diferencia: $0.00";
    } else {
      contenedorAlerta.className = "rounded-2xl p-3 border text-xs font-bold flex items-center justify-between bg-amber-50 border-amber-300 text-amber-900";
      icono.innerText = "⚠️";
      icono.className = "text-base text-amber-600";
      mensaje.innerText = `Descuadre matemático con el Total Factura`;
      badgeDif.className = "font-mono text-[11px] px-2.5 py-1 rounded-full bg-amber-200 text-amber-950 font-black";
      badgeDif.innerText = `Diferencia: ${diferencia > 0 ? '+' : ''}$${diferencia.toFixed(2)}`;
    }
  },

  async guardarFacturaVerificada() {
    const prov = document.getElementById("vFacProveedor").value.trim();
    const num = document.getElementById("vFacNumero").value.trim();
    const fecha = document.getElementById("vFacFecha").value;
    const inpTotal = document.getElementById("vFacInputTotalFactura");
    const totalFactura = parseFloat(inpTotal?.value) || 0;
    const impactarStock = this.impactarStockPVPActivo;

    if (!prov || !num) {
      if (typeof window.mostrarToast === "function") window.mostrarToast("Ingresa el Proveedor y el N° de Comprobante.", "warning");
      return;
    }

    if (totalFactura <= 0) {
      if (typeof window.mostrarToast === "function") window.mostrarToast("El Total de la Factura debe ser mayor a $0.00.", "warning");
      return;
    }

    // Advertencia previa si está duplicada antes de guardar
    if (!this.facturaIdEditando) {
      const existePrevia = state.facturasTodas.find(f => 
        String(f.numero_factura || "").trim().toLowerCase() === num.toLowerCase() &&
        String(f.proveedor || "").trim().toLowerCase() === prov.toLowerCase()
      );
      if (existePrevia) {
        const continuar = await window.confirmarAccion(
          `Factura #${num} ya existe`,
          `Ya registraste esta factura de ${prov}. ¿Deseas guardarla de todas formas como un nuevo registro?`
        );
        if (!continuar) return;
      }
    }

    const filas = document.querySelectorAll("#vFacTbodyItems tr");
    const items = [];
    let subtotal = 0;

    filas.forEach(tr => {
      const desc = tr.querySelector(".item-desc")?.value.trim();
      const cat = tr.querySelector(".item-cat")?.value || "General";
      const lote = tr.querySelector(".item-lote")?.value.trim() || "N/A";
      const cad = tr.querySelector(".item-cad")?.value || null;
      const cant = parseFloat(tr.querySelector(".item-cant")?.value) || 0;
      const pu = parseFloat(tr.querySelector(".item-pu")?.value) || 0;
      const dcto = parseFloat(tr.querySelector(".item-dcto")?.value) || 0;
      const tot = parseFloat(tr.querySelector(".item-tot")?.value) || 0;

      if (desc && cant > 0) {
        items.push({
          descripcion: desc,
          categoria: cat,
          lote: lote,
          fecha_caducidad: cad,
          cantidad: cant,
          precio_unitario: pu,
          porcentaje_descuento: dcto,
          precio_total: tot
        });
        subtotal += tot;
      }
    });

    const iva = +(subtotal * 0.15).toFixed(2);

    const payload = {
      proveedor: prov,
      numero_factura: num,
      fecha_emision: fecha,
      estado_pago: "Pendiente",
      subtotal: subtotal,
      impuestos: iva,
      total: totalFactura,
      items: items,
      impactar_stock_pvp: impactarStock
    };

    const btn = document.getElementById("btnGuardarFacturaVerificada");
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try {
      if (this.facturaIdEditando) {
        await api.actualizarFactura(this.facturaIdEditando, payload);
        if (typeof window.mostrarToast === "function") window.mostrarToast("Factura actualizada exitosamente.", "success");
      } else {
        const res = await api.guardarFactura(payload);
        if (this.archivosSubidosActuales.length > 0 && res.factura_id) {
          await api.adjuntarArchivoFactura(res.factura_id, this.archivosSubidosActuales).catch(e => console.warn("Fallo subiendo archivo:", e));
        }
        if (typeof window.mostrarToast === "function") window.mostrarToast("Factura registrada exitosamente.", "success");
      }

      this.cerrarModalVerificacion();

      if (typeof cargarDatosGlobales === "function") {
        await cargarDatosGlobales();
      }

    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerText = "Guardar Comprobante";
    }
  },

  async alternarEstadoPago(id, estadoActual) {
    const nuevo = estadoActual === "Pendiente" ? "Pagada" : "Pendiente";
    try {
      await api.actualizarEstadoPago(id, nuevo);
      const f = state.facturasTodas.find(x => x.id === id);
      if (f) f.estado_pago = nuevo;
      this.renderKPIs();
      this.renderTabla();
      if (typeof window.mostrarToast === "function") window.mostrarToast(`Factura marcada como ${nuevo}`, "info");
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  },

  idFacturaAEliminar: null,

  solicitarEliminarFactura(id, num) {
    this.idFacturaAEliminar = id;
    const lbl = document.getElementById("mElimFacTitulo");
    if (lbl) lbl.innerText = `¿Eliminar Factura #${num}?`;
    document.getElementById("modalEliminarFacturaOpciones")?.classList.remove("hidden");
  },

  cerrarModalEliminar() {
    this.idFacturaAEliminar = null;
    document.getElementById("modalEliminarFacturaOpciones")?.classList.add("hidden");
  },

  async confirmarEliminarAccion(revertirStock) {
    const id = this.idFacturaAEliminar;
    this.cerrarModalEliminar();
    if (!id) return;

    try {
      await api.eliminarFactura(id, revertirStock);
      state.facturasTodas = state.facturasTodas.filter(x => x.id !== id);
      this.renderKPIs();
      this.renderTabla();
      
      const msg = revertirStock 
        ? "Factura eliminada y stock descontado del inventario." 
        : "Factura eliminada (stock conservado en inventario).";
      
      if (typeof window.mostrarToast === "function") window.mostrarToast(msg, "info");

      if (typeof cargarDatosGlobales === "function") {
        await cargarDatosGlobales();
      }
    } catch (e) {
      if (typeof window.mostrarToast === "function") window.mostrarToast(e.message, "error");
    }
  }
};

window.ComponentePanelEstrategico = ComponentePanelEstrategico;