const CATEGORIAS_SISTEMA = [
  "General", "Restauración & Estética", "Endodoncia", "Ortodoncia",
  "Periodoncia & Profilaxis", "Impresión & Modelos", "Prótesis & Laboratorio",
  "Instrumental & Fresas", "Bioseguridad & Esterilización", "Equipos & Repuestos", "Gasto Operativo"
];

const apiMovil = {
  // 1. Obtener todas las facturas con sus ítems anidados
  async getFacturas() {
    const sql = `
      SELECT 
        f.id, 
        COALESCE(f.numero_factura, 'S/N') AS numero_factura, 
        f.fecha_emision, 
        COALESCE(f.estado_pago, 'Pendiente') AS estado_pago, 
        COALESCE(f.total, 0)::float AS total, 
        COALESCE(f.subtotal, 0)::float AS subtotal,
        COALESCE(f.impuestos, 0)::float AS impuestos,
        COALESCE(f.url_factura, '') AS url_factura,
        COALESCE(f.comentario, '') AS comentario, 
        COALESCE(p.nombre, 'Proveedor Desconocido') AS proveedor,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', df.id,
            'descripcion', df.descripcion,
            'categoria', COALESCE(df.categoria, 'General'),
            'lote', COALESCE(df.lote, 'N/A'),
            'cantidad', df.cantidad,
            'precio_unitario', df.precio_unitario,
            'porcentaje_descuento', COALESCE(df.porcentaje_descuento, 0),
            'precio_total', COALESCE(df.precio_total, df.cantidad * df.precio_unitario),
            'fecha_caducidad', df.fecha_caducidad::text
          ))
          FROM detalles_factura df 
          WHERE df.factura_id = f.id
        ), '[]'::json) AS items
      FROM facturas f
      LEFT JOIN proveedores p ON p.id = f.proveedor_id
      ORDER BY f.fecha_emision DESC NULLS LAST, f.id DESC;
    `;
    const res = await neonQuery(sql);
    return Array.isArray(res) ? res : [];
  },

  // 2. Obtener catálogo consolidado con histórico
  async getCatalogo() {
    const sql = `
      SELECT 
        d.descripcion AS producto,
        COALESCE(d.categoria, 'General') AS categoria,
        COUNT(d.id)::int AS total_compras,
        COALESCE(SUM(d.cantidad), COUNT(d.id))::numeric AS unidades_totales,
        MIN(d.precio_unitario) AS precio_min,
        MAX(d.precio_unitario) AS precio_max,
        ROUND(AVG(d.precio_unitario)::numeric, 2) AS precio_promedio,
        (
          SELECT p2.nombre 
          FROM detalles_factura d2 
          JOIN facturas f2 ON f2.id = d2.factura_id 
          JOIN proveedores p2 ON p2.id = f2.proveedor_id 
          WHERE d2.descripcion = d.descripcion 
          ORDER BY d2.precio_unitario ASC LIMIT 1
        ) AS mejor_proveedor,
        json_agg(
          json_build_object(
            'fecha', COALESCE(f.fecha_emision::text, 'S/F'),
            'proveedor', p.nombre,
            'factura', f.numero_factura,
            'precio', d.precio_unitario,
            'cantidad', d.cantidad,
            'descuento', COALESCE(d.porcentaje_descuento, 0)
          ) ORDER BY f.fecha_emision DESC NULLS LAST
        ) AS historial
      FROM detalles_factura d
      JOIN facturas f ON f.id = d.factura_id
      JOIN proveedores p ON p.id = f.proveedor_id
      WHERE d.categoria IS NULL OR d.categoria != 'Gasto Operativo'
      GROUP BY d.descripcion, d.categoria
      ORDER BY d.descripcion ASC;
    `;
    const res = await neonQuery(sql);
    return Array.isArray(res) ? res : [];
  },

  async cambiarEstadoPago(id, estado) {
    return await neonQuery("UPDATE facturas SET estado_pago = $1 WHERE id = $2;", [estado, id]);
  },

  async cambiarCategoria(descripcion, nueva_categoria) {
    return await neonQuery("UPDATE detalles_factura SET categoria = $1 WHERE descripcion = $2;", [nueva_categoria, descripcion]);
  },

  async guardarComentario(id, comentario) {
    return await neonQuery("UPDATE facturas SET comentario = $1 WHERE id = $2;", [comentario, id]);
  },

  async eliminarFactura(id) {
    await neonQuery("DELETE FROM detalles_factura WHERE factura_id = $1;", [id]);
    return await neonQuery("DELETE FROM facturas WHERE id = $1;", [id]);
  }
};

function parsearFechaISO(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (s === "" || s === "null" || s === "None" || s === "S/F") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function formatearFechaLatam(val) {
  const iso = parsearFechaISO(val);
  if (!iso) return "S/F";
  const p = iso.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}