/**
 * Motor de Extracción IA Mobadent para Android
 * Replica la lógica de fallback y estructuración del backend de PC.
 */

const MODELOS_IA_PRIORIDAD = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

const PROMPT_SISTEMA_FACTURA = `
Eres un auditor contable experto para la clínica dental Mobadent.
Analiza la imagen o comprobante de factura adjunto y extrae la información con máxima precisión matemática y fiscal.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "proveedor_nombre": "Nombre comercial o razón social",
  "proveedor_id_fiscal": "RUC o Cédula (solo dígitos)",
  "numero_factura": "001-001-000000001",
  "fecha_emision": "YYYY-MM-DD",
  "numero_autorizacion": "Clave SRI si existe o null",
  "base_iva_0": 0.00,
  "base_iva_grabada": 0.00,
  "porcentaje_iva": 15.0,
  "subtotal": 0.00,
  "descuento_total": 0.00,
  "impuestos": 0.00,
  "total": 0.00,
  "items": [
    {
      "descripcion": "Nombre del insumo dental o gasto",
      "categoria": "General",
      "lote": "N/A",
      "cantidad": 1.0,
      "precio_unitario": 0.00,
      "porcentaje_descuento": 0.0,
      "precio_total": 0.00
    }
  ]
}

Reglas obligatorias:
1. No incluyas explicaciones ni bloques markdown de código (\`\`\`json). Devuelve solo el JSON crudo.
2. Cada precio_total de ítem debe ser: (cantidad * precio_unitario) * (1 - porcentaje_descuento / 100).
3. Si el total general es cero o dudoso, calcúlalo rigurosamente como: subtotal + impuestos.
4. Categorías permitidas para cada ítem:
   - "General"
   - "Restauración & Estética"
   - "Endodoncia"
   - "Ortodoncia"
   - "Periodoncia & Profilaxis"
   - "Impresión & Modelos"
   - "Prótesis & Laboratorio"
   - "Instrumental & Fresas"
   - "Bioseguridad & Esterilización"
   - "Equipos & Repuestos"
   - "Gasto Operativo"
`;

/**
 * Procesa una o varias imágenes en Base64 usando Gemini AI con fallback automático de modelos.
 * @param {Array<{base64: string, mimeType: string}>} listaImagenes
 * @returns {Promise<Object>} Datos estructurados de la factura
 */
async function procesarFacturaConGeminiMobile(listaImagenes) {
  const cfg = window.CONFIG || (typeof CONFIG !== "undefined" ? CONFIG : null);
  const apiKey = cfg ? cfg.GEMINI_API_KEY : null;

  if (!apiKey || apiKey === "TU_GEMINI_API_KEY") {
    throw new Error("No se ha configurado GEMINI_API_KEY en config.js");
  }

  // Prepara los contenidos en formato de Google Generative Language API
  const partesImagen = listaImagenes.map(img => {
    // Limpia encabezados de data URL si vienen incluidos
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
      topP: 0.95,
      responseMimeType: "application/json"
    }
  };

  let ultimoError = null;

  // Mecanismo de reintento en cascada: prueba modelo por modelo
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
        console.warn(`Modelo ${modelo} no disponible o falló: ${mensaje}`);
        ultimoError = new Error(mensaje);
        continue; // Intenta con el siguiente modelo de la lista
      }

      const respuestaJson = await res.json();
      const candidato = respuestaJson.candidates?.[0];
      const textoGenerado = candidato?.content?.parts?.[0]?.text;

      if (!textoGenerado) {
        throw new Error("Gemini no devolvió texto en la respuesta.");
      }

      // Limpia posibles etiquetas markdown residuales
      const jsonLimpio = textoGenerado.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const resultado = JSON.parse(jsonLimpio);

      // Verificación y validación de totales
      if (!resultado.total || parseFloat(resultado.total) === 0) {
        const sumaItems = (resultado.items || []).reduce((acc, it) => acc + (parseFloat(it.precio_total) || 0), 0);
        resultado.subtotal = resultado.subtotal || sumaItems;
        resultado.impuestos = resultado.impuestos || +(resultado.subtotal * 0.15).toFixed(2);
        resultado.total = +(resultado.subtotal + resultado.impuestos).toFixed(2);
      }

      return resultado;

    } catch (err) {
      ultimoError = err;
      console.warn(`Error con modelo ${modelo}:`, err.message);
    }
  }

  throw new Error(`Error de extracción: ${ultimoError?.message || "No se pudo comunicar con ningún modelo de Gemini."}`);
}

window.procesarFacturaConGeminiMobile = procesarFacturaConGeminiMobile;