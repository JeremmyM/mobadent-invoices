// mobadent-mobile/www/db.js

// 1. Ejecutor SQL directo sobre Neon (HTTP Serverless Endpoint)
async function neonQuery(sql, params = []) {
  try {
    const cfg = window.CONFIG || CONFIG;
    const rawUrl = cfg ? cfg.NEON_DATABASE_URL : null;
    if (!rawUrl) throw new Error("NEON_DATABASE_URL no encontrada en config.js");

    const match = rawUrl.match(/@([^/]+)\//);
    if (!match) throw new Error("Formato de URL de Neon inválido.");
    const host = match[1];

    const endpoint = `https://${host}/sql`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": rawUrl
      },
      body: JSON.stringify({
        query: sql,
        params: params
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Respuesta error Neon:", response.status, errText);
      throw new Error(`Neon HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    
    // Si viene como array directo de objetos
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0])) {
      return data;
    }

    // Si viene en data.rows
    if (data && data.rows) {
      if (data.rows.length === 0) return [];
      if (typeof data.rows[0] === 'object' && !Array.isArray(data.rows[0])) {
        return data.rows;
      }
      // Si rows es matriz y hay fields
      if (data.fields && Array.isArray(data.fields)) {
        const fieldNames = data.fields.map(f => (typeof f === 'string' ? f : f.name));
        return data.rows.map(row => {
          const obj = {};
          fieldNames.forEach((name, idx) => {
            obj[name] = row[idx];
          });
          return obj;
        });
      }
      return data.rows;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error en neonQuery:", error);
    throw error;
  }
}

// 2. Comprobador de actualizaciones automáticas desde Neon
async function verificarActualizacionDisponible() {
  try {
    const cfg = window.CONFIG || CONFIG;
    const sql = `
      SELECT version_codigo, version_nombre, novedades, url_apk, es_obligatoria
      FROM app_versiones
      ORDER BY version_codigo DESC
      LIMIT 1;
    `;
    const resultado = await neonQuery(sql);
    if (!resultado || resultado.length === 0) return null;

    const ultimaVersion = resultado[0];
    const codigoServidor = parseInt(ultimaVersion.version_codigo);
    const codigoLocal = parseInt((cfg && cfg.APP_VERSION_CODE) ? cfg.APP_VERSION_CODE : 1);

    if (codigoServidor > codigoLocal) {
      return ultimaVersion;
    }
    return null;
  } catch (error) {
    console.warn("Aviso al comprobar actualización en Neon:", error);
    return null;
  }
}

// 3. Subida directa de comprobantes a Supabase Storage
async function subirImagenASupabase(file) {
  try {
    const cfg = window.CONFIG || CONFIG;
    const extension = file.name ? file.name.split('.').pop() : 'jpg';
    const nombreArchivo = `movil_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    const res = await fetch(`${cfg.SUPABASE_URL}/storage/v1/object/facturas/${nombreArchivo}`, {
      method: "POST",
      headers: {
        "apikey": cfg.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${cfg.SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "image/jpeg"
      },
      body: file
    });

    if (!res.ok) {
      console.warn("Aviso en Supabase Storage:", await res.text());
      return null;
    }

    return `${cfg.SUPABASE_URL}/storage/v1/object/public/facturas/${nombreArchivo}`;
  } catch (e) {
    console.warn("Fallo al subir a Supabase:", e);
    return null;
  }
}

// 4. Conversión a Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({ data: base64Data, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = error => reject(error);
  });
}

// 5. Extracción con Gemini AI
async function extraerFacturaConGemini(archivos) {
  const cfg = window.CONFIG || CONFIG;
  const partes = [];

  for (const f of archivos) {
    const b64 = await fileToBase64(f);
    partes.push({
      inline_data: {
        mime_type: b64.mimeType,
        data: b64.data
      }
    });
  }

  const prompt = `Analiza estas hojas de factura dental. Consolida todos los items secuencialmente.
Categorías válidas: 'Restauración & Estética', 'Endodoncia', 'Ortodoncia', 'Periodoncia & Profilaxis', 'Impresión & Modelos', 'Prótesis & Laboratorio', 'Instrumental & Fresas', 'Bioseguridad & Esterilización', 'Equipos & Repuestos', 'Gasto Operativo' o 'General'.
Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "proveedor_nombre": "string",
  "proveedor_id_fiscal": "string",
  "numero_factura": "string",
  "fecha_emision": "YYYY-MM-DD",
  "numero_autorizacion": "string o null",
  "base_iva_0": 0.0,
  "base_iva_grabada": 0.0,
  "subtotal": 0.0,
  "descuento_total": 0.0,
  "impuestos": 0.0,
  "total": 0.0,
  "items": [
    {
      "descripcion": "string",
      "categoria": "string",
      "lote": "string o N/A",
      "cantidad": 1.0,
      "precio_unitario": 0.0,
      "porcentaje_descuento": 0.0,
      "subtotal": 0.0
    }
  ]
}`;

  partes.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cfg.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: partes }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Error: ${err}`);
  }

  const jsonResp = await res.json();
  const rawText = jsonResp.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}