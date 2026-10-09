/**
 * Motor de Extracción IA Mobadent para Android (Ecuador)
 * Soporte especializado para facturas de Distridental, Prodentec, Dentalcorp, Krobalto.
 * Manejo de descuentos en cascada, extracción de lotes y asignación inteligente de IVA.
 */

const MODELOS_IA_PRIORIDAD = [
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash"
];

function normalizarFechaEcuadorJS(v) {
  if (!v || String(v).toLowerCase() === "null" || String(v).toLowerCase() === "none" || String(v).toLowerCase() === "s/f") {
    return null;
  }
  const str = String(v).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const dia = m[1].padStart(2, '0');
    const mes = m[2].padStart(2, '0');
    const anio = m[3];
    return `${anio}-${mes}-${dia}`;
  }
  
  const mCorto = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})/);
  if (mCorto) {
    const dia = mCorto[1].padStart(2, '0');
    const mes = mCorto[2].padStart(2, '0');
    const anio = `20${mCorto[3]}`;
    return `${anio}-${mes}-${dia}`;
  }
  
  return null;
}

const PROMPT_SISTEMA_FACTURA = `
Eres un auditor contable experto en insumos odontológicos y facturación comercial en Ecuador (Distridental, Prodentec, Dentalcorp, Krobalto).
Analiza la factura adjunta y extrae la información con máxima precisión matemática y fiscal.

REGLAS DE EXTRACCIÓN (ECUADOR):
1. FECHAS:
   - 'fecha_emision': En Ecuador siempre viene en formato DD-MM-YYYY o DD/MM/YYYY. Conviértela a ISO 'YYYY-MM-DD'.
2. DESCUENTOS EN CASCADA / DOS COLUMNAS DE DESCUENTO:
   - Si existen dos columnas contiguas de descuento (ejemplo: '50.00' y '20.00'), calcula el descuento efectivo:
     descuento_total = 1 - (1 - d1/100) * (1 - d2/100). Para 50% y 20%, pon 60.0 en 'porcentaje_descuento'.
3. LOTE Y VENCIMIENTO:
   - En Distridental: el lote aparece bajo la descripción ('Lote C843N') y la fecha en la columna contigua ('29/02/2028').
   - En Prodentec: figura en 'Det. Adicional' como 'Lote: XXXXX Ven.DD/MM/AAAA'.
   - Extrae 'lote' limpio (ej: 'C843N'). Si no hay, pon 'N/A'.
   - Extrae 'fecha_caducidad' en ISO 'YYYY-MM-DD'. Si no hay, pon null.
4. LÍNEAS DE ENVÍO / FLETE Y TARIFA IVA:
   - Si una línea dice 'COSTO DE ENVIO' o 'FLETE', clasifícala como 'Gasto Operativo'.
   - Si la factura en su liquidación final cobra IVA 15% sobre el envío (como en Distridental), asigna 'tarifa_iva': 15 a esa línea. Si está exenta, pon 0.
5. RESUMEN DE TOTALES:
   - Si los ítems ya reflejan el descuento en su valor neto, 'descuento_global' debe ser 0.00 para no duplicar deducciones.
   - 'subtotal': El subtotal neto gravado antes de impuestos.
   - 'impuestos': El valor monetario del IVA liquidado.
   - 'total': El importe total que figura al final del comprobante.

Devuelve ÚNICAMENTE este JSON plano sin bloques markdown:
{
  "proveedor_nombre": "Razón social del emisor",
  "proveedor_id_fiscal": "RUC del emisor (13 dígitos)",
  "numero_factura": "000-000-000000000",
  "fecha_emision": "YYYY-MM-DD",
  "descuento_global": 0.00,
  "subtotal": 0.00,
  "impuestos": 0.00,
  "total": 0.00,
  "items": [
    {
      "descripcion": "Nombre del producto",
      "categoria": "General",
      "lote": "N/A",
      "fecha_caducidad": "YYYY-MM-DD",
      "cantidad": 1.0,
      "precio_unitario": 0.00,
      "porcentaje_descuento": 0.0,
      "tarifa_iva": 15
    }
  ]
}

Categorías válidas: 'Restauración & Estética', 'Endodoncia', 'Ortodoncia', 'Periodoncia & Profilaxis', 'Impresión & Modelos', 'Prótesis & Laboratorio', 'Instrumental & Fresas', 'Bioseguridad & Esterilización', 'Equipos & Repuestos', 'Gasto Operativo' o 'General'.
`;

async function procesarFacturaConGeminiMobile(listaImagenes) {
  const cfg = window.CONFIG || (typeof CONFIG !== "undefined" ? CONFIG : null);
  const rawKeys = cfg ? (cfg.GEMINI_API_KEY || "") : "";
  const claves = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

  if (claves.length === 0 || claves[0] === "TU_GEMINI_API_KEY") {
    throw new Error("No se ha configurado GEMINI_API_KEY en config.js");
  }

  const partesImagen = listaImagenes.map(img => {
    const base64Limpio = img.base64.replace(/^data:[^;]+;base64,/, "");
    return {
      inline_data: {
        mime_type: img.mimeType || "image/jpeg",
        data: base64Limpio
      }
    };
  });

  const requestBody = {
    contents: [
      {
        parts: [
          { text: PROMPT_SISTEMA_FACTURA },
          ...partesImagen
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  let ultimoError = null;

  for (const apiKey of claves) {
    for (const modelo of MODELOS_IA_PRIORIDAD) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const mensaje = errorData.error?.message || `HTTP ${res.status}`;
          ultimoError = new Error(mensaje);
          continue;
        }

        const respuestaJson = await res.json();
        const candidato = respuestaJson.candidates?.[0];
        const textoGenerado = candidato?.content?.parts?.[0]?.text;

        if (!textoGenerado) continue;

        const jsonLimpio = textoGenerado.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        const resultado = JSON.parse(jsonLimpio);

        if (resultado.fecha_emision) {
          resultado.fecha_emision = normalizarFechaEcuadorJS(resultado.fecha_emision);
        }

        if (Array.isArray(resultado.items)) {
          resultado.items.forEach(it => {
            if (it.fecha_caducidad) {
              it.fecha_caducidad = normalizarFechaEcuadorJS(it.fecha_caducidad);
            }
          });
        }

        return resultado;

      } catch (err) {
        ultimoError = err;
      }
    }
  }

  throw new Error(`Error de extracción: ${ultimoError?.message || "No se pudo comunicar con ningún modelo de Gemini."}`);
}

window.procesarFacturaConGeminiMobile = procesarFacturaConGeminiMobile;
window.normalizarFechaEcuadorJS = normalizarFechaEcuadorJS;