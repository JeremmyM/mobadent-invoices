/**
 * Conector de Base de Datos Mobadent con Control de Acceso por Hardware Inmutable
 * - Sin peticiones continuas (Zero Battery & Zero Compute waste)
 * - Interfaz limpia sin menciones técnicas a Neon
 * - Bloqueo instantáneo ante cualquier intento de consulta no autorizada
 */

const STORAGE_DEVICE_KEY = "mobadent_hardware_device_id";

// 1. Obtener identificador permanente de hardware
async function obtenerIdDispositivo() {
  let devId = localStorage.getItem(STORAGE_DEVICE_KEY);

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
    try {
      const info = await window.Capacitor.Plugins.Device.getId();
      if (info && info.identifier) {
        const hashHardware = info.identifier.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-8);
        devId = `MOBA-${hashHardware.slice(0, 4)}-${hashHardware.slice(4, 8)}`;
        localStorage.setItem(STORAGE_DEVICE_KEY, devId);
        return devId;
      }
    } catch (e) {
      console.warn("Fallo al leer ID de hardware Capacitor:", e);
    }
  }

  if (!devId) {
    const hexAleatorio = Math.random().toString(36).substring(2, 6).toUpperCase();
    const hexNum = Math.floor(1000 + Math.random() * 9000);
    devId = `MOBA-${hexAleatorio}-${hexNum}`;
    localStorage.setItem(STORAGE_DEVICE_KEY, devId);
  }
  return devId;
}

// 2. Parser y Ejecutor Oficial contra el Endpoint HTTP
async function ejecutarPeticionNeonHttp(rawConnectionString, sql, params = []) {
  if (!rawConnectionString) {
    throw new Error("Servidor no configurado.");
  }

  let connectionString = rawConnectionString.trim();
  let host = "";

  try {
    if (connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://")) {
      const urlParsed = new URL(connectionString.replace(/^postgres:\/\//, "postgresql://"));
      host = urlParsed.host;
    } else if (connectionString.startsWith("https://")) {
      const urlParsed = new URL(connectionString);
      host = urlParsed.host;
    } else {
      host = connectionString.split("@")[1]?.split("/")[0] || connectionString;
    }
  } catch (err) {
    throw new Error("Configuración de servidor inválida: " + err.message);
  }

  const endpoint = `https://${host}/sql`;

  const headers = {
    "Content-Type": "application/json",
    "Neon-Connection-String": connectionString
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ query: sql, params: params })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error en servidor (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.records && Array.isArray(data.records)) return data.records;
  return data;
}

// 3. Crear o mostrar el overlay de bloqueo de hardware (Diseño limpio y profesional)
function mostrarBloqueoTerminal(devId) {
  let overlay = document.getElementById("pantallaTerminalBloqueado");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pantallaTerminalBloqueado";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10000000;
      background: #020b12; color: white; display: flex;
      flex-direction: column; align-items: center; justify-content: center;
      padding: 24px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: opacity 0.3s ease;
    `;

    overlay.innerHTML = `
      <div style="width: 72px; height: 72px; border-radius: 24px; background: rgba(239, 68, 68, 0.15); border: 1.5px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 24px; box-shadow: 0 0 30px rgba(239, 68, 68, 0.2);">
        🔒
      </div>
      <h2 style="font-size: 22px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.5px;">Acceso No Autorizado</h2>
      <p style="font-size: 13px; color: #94a3b8; max-width: 290px; line-height: 1.5; margin: 0 0 20px 0;">
        Este dispositivo no cuenta con permisos activos para consultar la información de la clínica.
      </p>
      
      <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); padding: 14px 24px; border-radius: 16px; margin-bottom: 16px; width: 100%; max-width: 290px; box-sizing: border-box;">
        <span style="font-size: 10px; color: #38bdf8; display: block; font-weight: 800; letter-spacing: 1px; margin-bottom: 4px;">IDENTIFICADOR DE TERMINAL:</span>
        <span id="txtDevIdTerminal" style="font-size: 19px; font-weight: 900; letter-spacing: 2px; font-family: monospace; color: #ffffff;">${devId}</span>
      </div>

      <div id="alertaEstadoAprobacion" style="display: none; font-size: 12px; font-weight: bold; margin-bottom: 16px; max-width: 290px; padding: 10px 14px; border-radius: 12px; line-height: 1.4;"></div>

      <p style="font-size: 11px; color: #64748b; margin: 0 0 24px 0; max-width: 260px;">
        Comunícate con la administración de la clínica para activar este terminal.
      </p>

      <button id="btnVerificarTerminalEnVivo" onclick="window.verificarAprobacionEnVivo()" style="background: #0284c7; color: white; border: none; padding: 12px 28px; border-radius: 14px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); transition: all 0.2s;">
        Comprobar Estado
      </button>
    `;

    document.documentElement.appendChild(overlay);
  }
  
  const txtDev = document.getElementById("txtDevIdTerminal");
  if (txtDev) txtDev.innerText = devId;

  overlay.style.display = "flex";
  overlay.style.opacity = "1";
}

// 4. Ocultar pantalla de bloqueo
function ocultarBloqueoTerminal() {
  const overlay = document.getElementById("pantallaTerminalBloqueado");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 250);
  }
}

// 5. Botón interactivo: comprueba el permiso en vivo sin recargar la página
window.verificarAprobacionEnVivo = async function() {
  const btn = document.getElementById("btnVerificarTerminalEnVivo");
  const alerta = document.getElementById("alertaEstadoAprobacion");
  
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Verificando...";
    btn.style.opacity = "0.7";
  }

  const { aprobado, error } = await validarAutorizacionHardware(true);

  if (aprobado) {
    if (alerta) {
      alerta.style.display = "block";
      alerta.style.background = "rgba(16, 185, 129, 0.2)";
      alerta.style.border = "1px solid #10b981";
      alerta.style.color = "#34d399";
      alerta.innerText = "✓ Dispositivo Autorizado. Accediendo...";
    }
    setTimeout(() => {
      ocultarBloqueoTerminal();
    }, 450);
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Comprobar Estado";
      btn.style.opacity = "1";
    }
    if (alerta) {
      alerta.style.display = "block";
      alerta.style.background = "rgba(239, 68, 68, 0.2)";
      alerta.style.border = "1px solid #ef4444";
      alerta.style.color = "#f87171";
      alerta.innerHTML = error 
        ? `⚠️ Error de comunicación con el servidor.` 
        : `⚠️ Este terminal aún no ha sido autorizado por la administración.`;
    }
  }
};

// 6. Validación de Hardware Robusta (Tolerante a espacios y mayúsculas)
async function validarAutorizacionHardware(esManual = false) {
  const devId = await obtenerIdDispositivo();
  const devIdLimpio = devId.trim();
  const cfg = window.CONFIG || (typeof CONFIG !== "undefined" ? CONFIG : null);

  if (!cfg || !cfg.NEON_DATABASE_URL) {
    if (!esManual) mostrarBloqueoTerminal(devIdLimpio);
    return { aprobado: false, error: "Servidor no configurado" };
  }

  try {
    const sqlCheck = "SELECT autorizado FROM dispositivos_autorizados WHERE LOWER(TRIM(device_id)) = LOWER($1) LIMIT 1;";
    const res = await ejecutarPeticionNeonHttp(cfg.NEON_DATABASE_URL, sqlCheck, [devIdLimpio]);

    // Si fue eliminado o nunca existió, se auto-registra como pendiente
    if (!res || res.length === 0) {
      const sqlInsert = "INSERT INTO dispositivos_autorizados (device_id, alias, autorizado) VALUES ($1, 'Teléfono Android', FALSE) ON CONFLICT (device_id) DO NOTHING;";
      await ejecutarPeticionNeonHttp(cfg.NEON_DATABASE_URL, sqlInsert, [devIdLimpio]).catch(() => {});
      mostrarBloqueoTerminal(devIdLimpio);
      return { aprobado: false, error: null };
    }

    const estaAutorizado = (res[0].autorizado === true || res[0].autorizado === "t" || res[0].autorizado === 1 || res[0].autorizado === "true");

    if (estaAutorizado) {
      ocultarBloqueoTerminal();
      return { aprobado: true, error: null };
    } else {
      mostrarBloqueoTerminal(devIdLimpio);
      return { aprobado: false, error: null };
    }

  } catch (error) {
    console.error("Error al validar hardware:", error);
    if (!esManual) mostrarBloqueoTerminal(devIdLimpio);
    return { aprobado: false, error: error.message };
  }
}

// 7. Envoltorio de consultas
// Cada vez que la app pide facturas, guarda o lee el catálogo, valida el hardware.
// Si eliminaste o desactivaste el dispositivo, la consulta se corta al instante y bloquea la pantalla.
async function neonQuery(query, params = []) {
  const { aprobado } = await validarAutorizacionHardware();
  if (!aprobado) {
    throw new Error("Acceso denegado: terminal bloqueado.");
  }

  const cfg = window.CONFIG || CONFIG;
  return await ejecutarPeticionNeonHttp(cfg.NEON_DATABASE_URL, query, params);
}

// Inicialización limpia al abrir la vista
window.addEventListener("DOMContentLoaded", () => {
  validarAutorizacionHardware();
});

window.neonQuery = neonQuery;
window.obtenerIdDispositivo = obtenerIdDispositivo;