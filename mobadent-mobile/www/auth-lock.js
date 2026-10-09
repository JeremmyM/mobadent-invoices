/**
 * Mobadent Invoices - Seguridad y Autenticación Biométrica Nativa (Estilo Sberbank)
 * - Botón dinámico Huella ⇄ Borrar (⌫)
 * - Cierre de sesión automático al cerrar la app o al pasar >45 seg minimizada
 * - Disparo de evento al desbloquear para comprobación de versión
 */
(function() {
  const PIN_LENGTH = 5;
  const STORAGE_KEY = "mobadent_security_pin";
  const SESSION_TOKEN = "mobadent_active_session_flag";
  const BACKGROUND_TIME_KEY = "mobadent_bg_timestamp";
  const TIMEOUT_BACKGROUND_MAX_MS = 45 * 1000; 
  const TIMEOUT_INACTIVIDAD_MS = 5 * 60 * 1000; 

  const CLAVE_RECUPERACION_ADMIN = "mobadent2026";

  let pinActual = "";
  let pinTemporalCreacion = "";
  let modoConfiguracion = false;
  let temporizadorInactividad = null;
  let biometricaEnProgreso = false;

  const style = document.createElement("style");
  style.innerHTML = `
    .aurora-bg {
      background: radial-gradient(circle at 80% 15%, rgba(13, 148, 136, 0.42), transparent 50%),
                  radial-gradient(circle at 15% 85%, rgba(14, 116, 144, 0.48), transparent 50%),
                  radial-gradient(circle at 50% 35%, rgba(8, 47, 73, 0.75), transparent 60%),
                  linear-gradient(180deg, #04131f 0%, #020b12 100%);
      background-color: #020b12;
    }
    .key-btn {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .key-btn:active {
      background: rgba(255, 255, 255, 0.55);
      transform: scale(0.92);
    }
    .pin-box {
      width: 46px;
      height: 52px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.6);
      border: 1.5px solid rgba(56, 189, 248, 0.35);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .pin-box.active {
      background: rgba(255, 255, 255, 0.95);
      border-color: #38bdf8;
      box-shadow: 0 0 18px rgba(56, 189, 248, 0.65);
      transform: scale(1.05);
    }
    .pin-box.error {
      background: rgba(239, 68, 68, 0.4);
      border-color: #ef4444;
      animation: shake 0.35s ease-in-out;
    }
    .logo-container-muela {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(56, 189, 248, 0.35);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.7), 0 0 20px rgba(13, 148, 136, 0.3);
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
  `;
  document.head.appendChild(style);

  function crearPantallaBloqueo() {
    if (document.getElementById("pantallaBloqueoPin")) return;

    const contenedor = document.createElement("div");
    contenedor.id = "pantallaBloqueoPin";
    contenedor.className = "fixed inset-0 z-[999999] aurora-bg flex flex-col justify-between p-6 select-none text-white transition-opacity duration-300";

    contenedor.innerHTML = `
      <div class="pt-4 max-w-sm mx-auto w-full">
        <div class="w-16 h-16 rounded-2xl logo-container-muela flex items-center justify-center p-2 mb-5 mx-0">
          <img id="imgLogoMobadent" 
               src="assets/icon.png" 
               alt="Mobadent Logo" 
               class="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(56,189,248,0.5)]"
               onerror="
                 if (this.src.indexOf('assets/icon.png') !== -1) {
                   this.src = 'icon.png';
                 } else if (this.src.indexOf('icon.png') !== -1) {
                   this.src = 'app.png';
                 } else if (this.src.indexOf('app.png') !== -1) {
                   this.src = 'app.ico';
                 }
               ">
        </div>
        <h2 id="lblTituloSaludo" class="text-3xl font-black tracking-tight leading-tight text-white drop-shadow-md">
          Hola, Jeremmy
        </h2>
        <p id="lblSubtituloPin" class="text-sm text-cyan-200/80 font-medium mt-1">
          Ingresa tu PIN de seguridad
        </p>
      </div>

      <div class="flex justify-center gap-3 my-4 max-w-sm mx-auto w-full" id="contenedorCasillasPin">
        <div class="pin-box" id="pinBox0"></div>
        <div class="pin-box" id="pinBox1"></div>
        <div class="pin-box" id="pinBox2"></div>
        <div class="pin-box" id="pinBox3"></div>
        <div class="pin-box" id="pinBox4"></div>
      </div>

      <div class="max-w-xs mx-auto w-full pb-6">
        <div class="grid grid-cols-3 gap-3.5 mb-2 text-slate-800 font-black">
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('1')">1</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('2')">2</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('3')">3</button>

          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('4')">4</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('5')">5</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('6')">6</button>

          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('7')">7</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('8')">8</button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('9')">9</button>

          <button type="button" class="h-16 flex items-center justify-center text-xs font-bold text-cyan-200/80 active:text-white" onclick="window.AuthSecurity.abrirModalRecuperacion()">
            ¿Olvidaste el PIN?
          </button>
          <button type="button" class="key-btn h-16 rounded-2xl text-2xl font-black shadow-sm" onclick="window.AuthSecurity.pulsarTecla('0')">0</button>
          
          <button type="button" id="btnAccionDinamica" class="key-btn h-16 rounded-2xl flex items-center justify-center shadow-sm text-slate-800 transition-all cursor-pointer" onclick="window.AuthSecurity.ejecutarAccionDinamica()">
            <span id="svgHuellaIcon" class="text-xs font-black tracking-wider uppercase text-slate-700">Huella</span>
            <span id="txtBorrarIcon" class="hidden text-xl font-black text-slate-800">⌫</span>
          </button>
        </div>
      </div>

      <div id="modalRecuperacion" class="hidden fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
        <div class="bg-white rounded-3xl p-6 w-full max-w-sm text-slate-800 shadow-2xl space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl logo-container-muela flex items-center justify-center p-2">
              <img src="assets/icon.png" alt="Mobadent" class="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(56,189,248,0.4)]" 
                   onerror="this.src='icon.png'; this.onerror=function(){this.src='app.png';};">
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 leading-tight">Restablecer PIN</h3>
              <p class="text-xs text-slate-500">Verificación de administrador</p>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">Clave de Administrador:</label>
            <input type="password" id="inputClaveAdmin" placeholder="Ingresa la clave maestra" 
                   class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
            <p id="msgErrorRecuperacion" class="hidden text-[11px] text-rose-600 font-bold mt-1.5"></p>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onclick="window.AuthSecurity.cerrarModalRecuperacion()" class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">
              Cancelar
            </button>
            <button type="button" onclick="window.AuthSecurity.validarRecuperacion()" class="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition">
              Restablecer
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(contenedor);
  }

  function actualizarCasillas() {
    for (let i = 0; i < PIN_LENGTH; i++) {
      const box = document.getElementById(`pinBox${i}`);
      if (!box) continue;
      if (i < pinActual.length) {
        box.classList.add("active");
        box.innerHTML = `<span class="w-3.5 h-3.5 bg-slate-900 rounded-full shadow-inner"></span>`;
      } else {
        box.classList.remove("active");
        box.innerHTML = "";
      }
    }

    const svgHuella = document.getElementById("svgHuellaIcon");
    const txtBorrar = document.getElementById("txtBorrarIcon");
    if (svgHuella && txtBorrar) {
      if (pinActual.length === 0) {
        svgHuella.classList.remove("hidden");
        txtBorrar.classList.add("hidden");
      } else {
        svgHuella.classList.add("hidden");
        txtBorrar.classList.remove("hidden");
      }
    }
  }

  function animarError() {
    for (let i = 0; i < PIN_LENGTH; i++) {
      const box = document.getElementById(`pinBox${i}`);
      if (box) box.classList.add("error");
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    setTimeout(() => {
      pinActual = "";
      actualizarCasillas();
      for (let i = 0; i < PIN_LENGTH; i++) {
        const box = document.getElementById(`pinBox${i}`);
        if (box) box.classList.remove("error");
      }
    }, 450);
  }

  function desbloquearApp() {
    sessionStorage.setItem(SESSION_TOKEN, "active");
    sessionStorage.setItem("last_active_ts", Date.now().toString());

    const pantalla = document.getElementById("pantallaBloqueoPin");
    if (pantalla) {
      pantalla.style.opacity = "0";
      setTimeout(() => {
        pantalla.classList.add("hidden");
        pantalla.style.opacity = "1";
        // Notificar que la app fue desbloqueada para revisar actualizaciones
        window.dispatchEvent(new CustomEvent("mobadent_desbloqueado"));
      }, 250);
    }
    pinActual = "";
    actualizarCasillas();
    reiniciarTemporizador();
  }

  function bloquearApp() {
    sessionStorage.removeItem(SESSION_TOKEN);

    const pantalla = document.getElementById("pantallaBloqueoPin");
    if (pantalla) {
      pantalla.classList.remove("hidden");
      pantalla.style.opacity = "1";
    }
    pinActual = "";
    actualizarCasillas();

    const pinGuardado = localStorage.getItem(STORAGE_KEY);
    const sub = document.getElementById("lblSubtituloPin");
    if (!pinGuardado) {
      modoConfiguracion = true;
      pinTemporalCreacion = "";
      if (sub) sub.innerText = "Crea un nuevo PIN de 5 dígitos";
    } else {
      modoConfiguracion = false;
      if (sub) sub.innerText = "Ingresa tu PIN de seguridad";
      setTimeout(solicitarBiometriaNativa, 250);
    }
  }

  function estaSesionActiva() {
    const token = sessionStorage.getItem(SESSION_TOKEN);
    if (!token) return false;

    const bgTime = localStorage.getItem(BACKGROUND_TIME_KEY);
    if (bgTime) {
      const transcurrido = Date.now() - parseInt(bgTime, 10);
      if (transcurrido > TIMEOUT_BACKGROUND_MAX_MS) {
        localStorage.removeItem(BACKGROUND_TIME_KEY);
        sessionStorage.removeItem(SESSION_TOKEN);
        return false;
      }
    }
    return true;
  }

  async function solicitarBiometriaNativa() {
    if (biometricaEnProgreso) return;
    if (!window.Capacitor || !window.Capacitor.Plugins) return;

    const Biometric = window.Capacitor.Plugins.NativeBiometric || window.Capacitor.Plugins.BiometricAuth;
    if (!Biometric) return;

    try {
      biometricaEnProgreso = true;
      let disponible = false;
      try {
        const check = await Biometric.isAvailable();
        disponible = (check && (check.isAvailable === true || check.hasCredentials === true));
      } catch (e) {
        disponible = true;
      }

      if (!disponible) {
        biometricaEnProgreso = false;
        return;
      }

      const res = await Biometric.verifyIdentity({
        reason: "Entrada a Mobadent Invoices",
        title: "Mobadent Invoices",
        subtitle: "Escanea tu huella dactilar",
        description: "Usa tu sensor biométrico o patrón del teléfono",
        negativeButtonText: "Escribir contraseña"
      });

      if (res === undefined || res === null || res === true || res.success !== false) {
        desbloquearApp();
      }

    } catch (error) {
      console.log("Biometría omitida por usuario:", error);
    } finally {
      biometricaEnProgreso = false;
    }
  }

  function verificarPinIngresado() {
    const pinGuardado = localStorage.getItem(STORAGE_KEY);

    if (modoConfiguracion) {
      if (!pinTemporalCreacion) {
        pinTemporalCreacion = pinActual;
        pinActual = "";
        actualizarCasillas();
        document.getElementById("lblSubtituloPin").innerText = "Confirma tu nuevo PIN de 5 dígitos";
      } else {
        if (pinActual === pinTemporalCreacion) {
          localStorage.setItem(STORAGE_KEY, pinActual);
          alert("¡PIN de seguridad configurado con éxito!");
          desbloquearApp();
        } else {
          alert("Los PINs no coinciden. Intenta de nuevo.");
          animarError();
          pinTemporalCreacion = "";
          document.getElementById("lblSubtituloPin").innerText = "Crea un nuevo PIN de 5 dígitos";
        }
      }
      return;
    }

    if (pinActual === pinGuardado) {
      desbloquearApp();
    } else {
      animarError();
    }
  }

  function reiniciarTemporizador() {
    sessionStorage.setItem("last_active_ts", Date.now().toString());
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(() => {
      bloquearApp();
    }, TIMEOUT_INACTIVIDAD_MS);
  }

  window.AuthSecurity = {
    pulsarTecla(num) {
      if (pinActual.length < PIN_LENGTH) {
        pinActual += num;
        actualizarCasillas();
        if (pinActual.length === PIN_LENGTH) {
          setTimeout(verificarPinIngresado, 100);
        }
      }
    },

    ejecutarAccionDinamica() {
      if (pinActual.length === 0) {
        solicitarBiometriaNativa();
      } else {
        pinActual = pinActual.slice(0, -1);
        actualizarCasillas();
      }
    },

    abrirModalRecuperacion() {
      const modal = document.getElementById("modalRecuperacion");
      const input = document.getElementById("inputClaveAdmin");
      const err = document.getElementById("msgErrorRecuperacion");
      if (modal && input) {
        input.value = "";
        if (err) err.classList.add("hidden");
        modal.classList.remove("hidden");
        input.focus();
      }
    },

    cerrarModalRecuperacion() {
      const modal = document.getElementById("modalRecuperacion");
      if (modal) modal.classList.add("hidden");
    },

    validarRecuperacion() {
      const input = document.getElementById("inputClaveAdmin");
      const err = document.getElementById("msgErrorRecuperacion");
      if (!input) return;

      if (input.value.trim() === CLAVE_RECUPERACION_ADMIN) {
        localStorage.removeItem(STORAGE_KEY);
        this.cerrarModalRecuperacion();
        bloquearApp();
      } else {
        if (err) {
          err.innerText = "Clave de administrador incorrecta.";
          err.classList.remove("hidden");
        }
      }
    },

    solicitarHuella: solicitarBiometriaNativa,
    bloquear: bloquearApp
  };

  window.addEventListener("DOMContentLoaded", () => {
    crearPantallaBloqueo();

    if (estaSesionActiva()) {
      const pantalla = document.getElementById("pantallaBloqueoPin");
      if (pantalla) pantalla.classList.add("hidden");
      reiniciarTemporizador();
    } else {
      bloquearApp();
    }

    ["touchstart", "click", "keydown", "scroll"].forEach(ev => {
      document.addEventListener(ev, reiniciarTemporizador, { passive: true });
    });

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          localStorage.setItem(BACKGROUND_TIME_KEY, Date.now().toString());
        } else {
          const bgTime = localStorage.getItem(BACKGROUND_TIME_KEY);
          if (bgTime) {
            const transcurrido = Date.now() - parseInt(bgTime, 10);
            localStorage.removeItem(BACKGROUND_TIME_KEY);
            if (transcurrido > TIMEOUT_BACKGROUND_MAX_MS) {
              bloquearApp();
            }
          }
        }
      });
    }
  });

})();