// =========================================================
// API CLIENT - MOBADENT ERP & POS
// =========================================================

const API_URL = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
  ? `${window.location.origin}/api`
  : "/api";

const api = {
  // -------------------------------------------------------
  // FACTURAS & AUDITORÍA
  // -------------------------------------------------------
  getFacturas: async () => {
    try {
      const resp = await fetch(`${API_URL}/facturas/listado`);
      if (!resp.ok) throw new Error(`Error ${resp.status} al obtener facturas`);
      return await resp.json();
    } catch (e) {
      console.error("Error en getFacturas:", e);
      return [];
    }
  },

  guardarFactura: async (payload) => {
    const resp = await fetch(`${API_URL}/facturas/guardar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error al guardar la factura" }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  actualizarFactura: async (id, payload) => {
    const resp = await fetch(`${API_URL}/facturas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error al actualizar factura" }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  actualizarEstadoPago: async (id, estado_pago, comentario = null) => {
    const resp = await fetch(`${API_URL}/facturas/${id}/estado-pago`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado_pago, comentario })
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al cambiar estado de pago`);
    return await resp.json();
  },

  eliminarFactura: async (id, revertirStock = false) => {
    const resp = await fetch(`${API_URL}/facturas/${id}?revertir_stock=${revertirStock}`, {
      method: "DELETE"
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al eliminar factura`);
    return await resp.json();
  },

  extraerFacturaIA: async (archivos) => {
    const formData = new FormData();
    const lista = Array.isArray(archivos) ? archivos : [archivos];
    for (const file of lista) {
      formData.append("files", file);
    }
    const resp = await fetch(`${API_URL}/facturas/extraer`, {
      method: "POST",
      body: formData
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error en extracción con IA" }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  adjuntarArchivoFactura: async (id, archivos) => {
    const formData = new FormData();
    const lista = Array.isArray(archivos) ? archivos : [archivos];
    for (const file of lista) {
      formData.append("files", file);
    }
    const resp = await fetch(`${API_URL}/facturas/${id}/subir-archivo`, {
      method: "PATCH",
      body: formData
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al adjuntar archivo`);
    return await resp.json();
  },

  // -------------------------------------------------------
  // CATÁLOGO MAESTRO & ANÁLISIS DE COSTOS
  // -------------------------------------------------------
  getCatalogo: async () => {
    try {
      const resp = await fetch(`${API_URL}/productos/catalogo-maestro`);
      if (!resp.ok) throw new Error(`Error ${resp.status} al obtener catálogo`);
      return await resp.json();
    } catch (e) {
      console.error("Error en getCatalogo:", e);
      return [];
    }
  },

  actualizarCategoria: async (descripcion, nueva_categoria) => {
    const resp = await fetch(`${API_URL}/insumos/cambiar-categoria`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion, nueva_categoria })
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al actualizar categoría`);
    return await resp.json();
  },

  buscarProductos: async (query) => {
    const resp = await fetch(`${API_URL}/productos/buscar-live?q=${encodeURIComponent(query)}`);
    if (!resp.ok) return { productos_agrupados: [] };
    return await resp.json();
  },

  getFlujoCaja: async () => {
    try {
      const resp = await fetch(`${API_URL}/analitica/flujo-caja`);
      if (!resp.ok) return { historico: [], promedio_mensual: 0 };
      return await resp.json();
    } catch (e) {
      console.error("Error en getFlujoCaja:", e);
      return { historico: [], promedio_mensual: 0 };
    }
  },

  // -------------------------------------------------------
  // INVENTARIO COMERCIAL PVP
  // -------------------------------------------------------
  getProductosPVP: async () => {
    try {
      const resp = await fetch(`${API_URL}/pvp/listado`);
      if (!resp.ok) throw new Error(`Error ${resp.status} al listar PVP`);
      return await resp.json();
    } catch (e) {
      console.error("Error en getProductosPVP:", e);
      return [];
    }
  },

  guardarProductoPVP: async (producto) => {
    const resp = await fetch(`${API_URL}/pvp/guardar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(producto)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error guardando ítem PVP" }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  ajustarStockPVP: async (id, delta) => {
    const resp = await fetch(`${API_URL}/pvp/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta })
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} ajustando existencias`);
    return await resp.json();
  },

  actualizarPrecioRapidoPVP: async (id, datosPrecio) => {
    const resp = await fetch(`${API_URL}/pvp/${id}/precio-rapido`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datosPrecio)
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al actualizar precio`);
    return await resp.json();
  },

  eliminarProductoPVP: async (id) => {
    const resp = await fetch(`${API_URL}/pvp/${id}`, {
      method: "DELETE"
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al eliminar producto`);
    return await resp.json();
  },

  limpiarAgotadosPVP: async () => {
    const resp = await fetch(`${API_URL}/pvp/limpiar-agotados`, {
      method: "POST"
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al limpiar agotados`);
    return await resp.json();
  },

  sincronizarFacturaStock: async (items) => {
    const resp = await fetch(`${API_URL}/pvp/sincronizar-factura`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    if (!resp.ok) throw new Error(`Error ${resp.status} al sincronizar stock`);
    return await resp.json();
  },

  // -------------------------------------------------------
  // TERMINAL POS & VENTAS
  // -------------------------------------------------------
  cobrarPOS: async (payload) => {
    const resp = await fetch(`${API_URL}/pos/cobrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error desconocido en el servidor al cobrar" }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  getVentasPOS: async () => {
    try {
      const resp = await fetch(`${API_URL}/pos/ventas-historial`);
      if (!resp.ok) {
        console.error(`Error HTTP ${resp.status} al consultar ventas-historial`);
        return [];
      }
      return await resp.json();
    } catch (e) {
      console.error("Error de conexión al obtener historial de ventas:", e);
      return [];
    }
  },

  editarVentaPOS: async (id, payload) => {
    const resp = await fetch(`${API_URL}/pos/ventas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error al modificar la venta." }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  },

  anularVentaPOS: async (id, devolverStock = true) => {
    const resp = await fetch(`${API_URL}/pos/ventas/${id}?devolver_stock=${devolverStock}`, {
      method: "DELETE"
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Error al anular la venta." }));
      throw new Error(err.detail || `Error HTTP ${resp.status}`);
    }
    return await resp.json();
  }
};

// Exposición global
window.api = api;