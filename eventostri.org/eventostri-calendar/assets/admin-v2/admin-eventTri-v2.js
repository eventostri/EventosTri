(function() {
  if (window.__eventosAdminV2Inicializado) {
    return;
  }
  window.__eventosAdminV2Inicializado = true;

  const adminConfig = window.eventostriAdminV2Config || {};
  const adminRestConfig = adminConfig.rest || {};
  const adminSettingsConfig = adminConfig.settings || {};
  const adminLabelsConfig = adminSettingsConfig.labels || adminConfig.labels || {};
  const apiEventosUrl = adminRestConfig.eventosUrl || '/wp-json/eventostri/v1/eventos';
  const apiEventosImportUrl = adminRestConfig.eventosImportUrl || '/wp-json/eventostri/v1/eventos/import';
  const apiEventosDeletePastUrl = adminRestConfig.eventosDeletePastUrl || '/wp-json/eventostri/v1/eventos/delete-past';
  const apiAuthStatusUrl = adminRestConfig.authStatusUrl || '/wp-json/eventostri/v1/auth-status';
  const apiExportCsvUrl = adminConfig.exportCsvUrl || '';
  const etiquetaNuevoEvento = adminLabelsConfig.new_event || adminLabelsConfig.newEvent || 'Nuevo evento';

  let eventos = [];
  let calendarioInstancia = null;
  let nonceRestCache = '';
  let editandoId = null;
  let sincronizacionEnCurso = false;
  let filtrosTipoSeleccionados = new Set();
  let filtrosLugarSeleccionados = new Set();
  let rangoVisibleMes = null;
  let terminoBusquedaAdmin = '';
  const historialModalAdmin = [];
  let omitirSiguientePopstateAdmin = false;
  let swipeAdminInicializado = false;

  const estadoSesionWP = {
    verificado: false,
    autenticado: false,
    puedeGuardar: false,
    tieneNonce: false,
    usuarioTexto: 'No detectado',
    detalle: 'Sin verificacion'
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function registrarModalAdminEnHistorial(modalId) {
    if (!window.history || typeof window.history.pushState !== 'function') {
      return;
    }
    window.history.pushState({ eventostriAdminModal: modalId }, document.title);
    historialModalAdmin.push(modalId);
  }

  function removerModalAdminEnHistorial(modalId, desdePopstate) {
    const index = historialModalAdmin.lastIndexOf(modalId);
    if (index === -1) {
      return;
    }

    historialModalAdmin.splice(index, 1);
    if (!desdePopstate && window.history && typeof window.history.back === 'function') {
      omitirSiguientePopstateAdmin = true;
      window.history.back();
    }
  }

  function inicializarBackGestureModalAdmin() {
    if (window.__eventostriAdminBackGesturesInicializado) {
      return;
    }
    window.__eventostriAdminBackGesturesInicializado = true;

    window.addEventListener('popstate', function() {
      if (omitirSiguientePopstateAdmin) {
        omitirSiguientePopstateAdmin = false;
        return;
      }

      const ultimoModal = historialModalAdmin[historialModalAdmin.length - 1];
      if (ultimoModal === 'modal-admin-v2') {
        cerrarModal(true);
      }
    });
  }

  function inicializarNavegacionSwipeAdmin(contenedor) {
    if (swipeAdminInicializado || !contenedor) {
      return;
    }
    swipeAdminInicializado = true;

    let touchStartX = 0;
    let touchStartY = 0;

    contenedor.addEventListener('touchstart', function(event) {
      if (!event.touches || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    contenedor.addEventListener('touchend', function(event) {
      if (!event.changedTouches || event.changedTouches.length !== 1 || !calendarioInstancia) {
        return;
      }
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX < 70 || absX < absY * 1.3) {
        return;
      }

      if (deltaX > 0) {
        calendarioInstancia.next();
      } else {
        calendarioInstancia.prev();
      }
    }, { passive: true });
  }

  function mostrarMensaje(texto, tipo = 'info') {
    const msg = qs('mensajeEstadoV2');
    if (!msg) return;
    msg.textContent = texto;
    msg.className = 'mensaje-estado ' + tipo;
  }

  function registrarLog(texto, tipo = 'info') {
    const contenedor = qs('apiLogListV2');
    if (!contenedor) return;

    const fila = document.createElement('div');
    fila.className = 'api-log-item ' + tipo;
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fila.textContent = '[' + hora + '] ' + texto;
    contenedor.prepend(fila);

    while (contenedor.childElementCount > 80) {
      contenedor.removeChild(contenedor.lastChild);
    }
  }

  function obtenerNonceRest() {
    if (nonceRestCache) {
      return nonceRestCache;
    }

    if (window.wpApiSettings && window.wpApiSettings.nonce) {
      return window.wpApiSettings.nonce;
    }

    const metaNonce = document.querySelector('meta[name="wp-rest-nonce"]');
    if (metaNonce && metaNonce.content) {
      return metaNonce.content;
    }

    return '';
  }

  function construirUrlEventoPorId(id) {
    return apiEventosUrl + '/' + encodeURIComponent(String(id));
  }

  async function enviarSolicitudJsonAutenticada(url, opciones = {}, mensajeError) {
    const estado = await verificarSesionWordPressAPI(true);
    if (!estado.autenticado || !estado.puedeGuardar) {
      registrarLog('Bloqueado guardado por sesion/permisos: ' + estado.detalle, 'warning');
      actualizarBanderaSesionUI();
      return null;
    }

    const headers = Object.assign({}, opciones.headers || {});
    const nonce = obtenerNonceRest();
    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }
    if (!Object.prototype.hasOwnProperty.call(headers, 'Content-Type') && opciones.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    sincronizacionEnCurso = true;
    try {
      const respuesta = await fetch(url, Object.assign({}, opciones, {
        credentials: 'same-origin',
        headers: headers
      }));

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
          throw new Error('No autorizado para guardar. Inicia sesion y verifica nonce REST.');
        }
        throw new Error((mensajeError || 'Error en la solicitud') + '. HTTP ' + respuesta.status);
      }

      const texto = await respuesta.text();
      if (!texto) {
        return { ok: true };
      }

      const data = JSON.parse(texto);
      if (!data || data.ok !== true) {
        throw new Error('La API respondio sin confirmar la operacion.');
      }

      return data;
    } catch (err) {
      registrarLog((mensajeError || 'Error en la solicitud') + ': ' + err.message, 'error');
      return null;
    } finally {
      sincronizacionEnCurso = false;
      deshabilitarAccionesModal(false);
    }
  }

  function actualizarBanderaSesionUI() {
    const flag = qs('wpAuthFlagV2');
    const detail = qs('wpAuthDetailsV2');
    if (!flag || !detail) return;

    flag.className = 'auth-pill';

    if (!estadoSesionWP.verificado) {
      flag.classList.add('state-pending');
      flag.textContent = 'Sin verificar';
      detail.textContent = 'Ejecuta Verificar sesion para comprobar acceso de guardado.';
      return;
    }

    if (estadoSesionWP.autenticado && estadoSesionWP.puedeGuardar) {
      flag.classList.add('state-ok');
      flag.textContent = 'Autorizado';
    } else if (estadoSesionWP.autenticado) {
      flag.classList.add('state-warn');
      flag.textContent = 'Sin permisos de guardado';
    } else {
      flag.classList.add('state-error');
      flag.textContent = 'No autenticado';
    }

    detail.textContent = estadoSesionWP.usuarioTexto + ' · ' + estadoSesionWP.detalle + (estadoSesionWP.tieneNonce ? ' · nonce OK' : ' · nonce ausente');
  }

  async function verificarSesionWordPressAPI(silencioso = false) {
    const nonce = obtenerNonceRest();
    estadoSesionWP.tieneNonce = Boolean(nonce);
    estadoSesionWP.autenticado = false;
    estadoSesionWP.puedeGuardar = false;
    estadoSesionWP.usuarioTexto = 'No autenticado';
    estadoSesionWP.detalle = 'Sin sesion activa';

    try {
      const headersEstado = nonce ? { 'X-WP-Nonce': nonce } : {};
      const resEstado = await fetch(apiAuthStatusUrl + '?_ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: headersEstado
      });

      if (resEstado.ok) {
        const estadoApi = await resEstado.json();
        if (estadoApi && estadoApi.ok === true) {
          if (estadoApi.nonce) {
            nonceRestCache = estadoApi.nonce;
            estadoSesionWP.tieneNonce = true;
          }

          estadoSesionWP.autenticado = Boolean(estadoApi.logged_in);
          estadoSesionWP.puedeGuardar = Boolean(estadoApi.can_sync);
          estadoSesionWP.usuarioTexto = estadoApi.user && (estadoApi.user.name || estadoApi.user.login)
            ? (estadoApi.user.name || estadoApi.user.login)
            : (estadoSesionWP.autenticado ? 'Usuario autenticado' : 'No autenticado');
          estadoSesionWP.detalle = estadoSesionWP.puedeGuardar
            ? 'Permisos de guardado confirmados'
            : (estadoSesionWP.autenticado ? 'Sin permisos para sincronizar' : 'Sin sesion activa');

          estadoSesionWP.verificado = true;
          actualizarBanderaSesionUI();
          if (!silencioso) {
            const tipo = (estadoSesionWP.autenticado && estadoSesionWP.puedeGuardar) ? 'success' : 'warning';
            registrarLog('Resultado sesion: ' + estadoSesionWP.usuarioTexto + ' | ' + estadoSesionWP.detalle, tipo);
          }
          return estadoSesionWP;
        }
      }
    } catch (errorEstado) {
      if (!silencioso) {
        registrarLog('Error consultando auth-status: ' + errorEstado.message, 'warning');
      }
    }

    estadoSesionWP.verificado = true;
    actualizarBanderaSesionUI();
    return estadoSesionWP;
  }

  function escapeHtml(texto) {
    return String(texto || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function obtenerPropiedad(evento, clave) {
    const key = Object.keys(evento || {}).find(k => k.toLowerCase() === String(clave).toLowerCase());
    return key ? evento[key] : '';
  }

  function normalizarWhatsapp(valor) {
    return String(valor || '')
      .split(/[\n,;]+/)
      .map(v => v.trim())
      .filter(Boolean)
      .join(', ');
  }

  function normalizarFechaLocal(valor) {
    if (!valor) return '';
    return String(valor).slice(0, 16);
  }

  function normalizarBoolean(valor, fallback) {
    if (valor === null || valor === undefined || valor === '') {
      return fallback;
    }
    if (typeof valor === 'boolean') {
      return valor;
    }
    if (typeof valor === 'number') {
      return valor === 1;
    }
    const texto = String(valor).trim().toLowerCase();
    if (texto === '1' || texto === 'true' || texto === 'yes' || texto === 'si' || texto === 'on') return true;
    if (texto === '0' || texto === 'false' || texto === 'no' || texto === 'off') return false;
    return fallback;
  }

  function normalizarId(valor) {
    if (valor === null || valor === undefined || valor === '') {
      return null;
    }
    const numero = parseInt(valor, 10);
    if (Number.isNaN(numero) || numero <= 0) {
      return null;
    }
    return numero;
  }

  function esEventoPasado(evento) {
    const fechaPlano = String(evento.Fecha_Hora || '').split(/[T ]/)[0];
    const partes = fechaPlano.split('-');
    if (partes.length !== 3) return false;
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    if (Number.isNaN(fecha.getTime())) return false;
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return fecha < inicioHoy;
  }

  function crearEventoNormalizado(origen = {}) {
    const id = normalizarId(obtenerPropiedad(origen, 'Id'));
    return {
      Id: id,
      _localId: origen._localId || (id !== null ? ('wp-' + id) : crypto.randomUUID()),
      Titulo: String(obtenerPropiedad(origen, 'Titulo') || 'Evento deportivo').trim(),
      Fecha_Hora: String(obtenerPropiedad(origen, 'Fecha_Hora') || '').trim(),
      Lugar: String(obtenerPropiedad(origen, 'Lugar') || '').trim(),
      Estado: String(obtenerPropiedad(origen, 'Estado') || 'YUC').trim(),
      Tipos: String(obtenerPropiedad(origen, 'Tipos') || '').trim(),
      Distancias: String(obtenerPropiedad(origen, 'Distancias') || '').trim(),
      Link: String(obtenerPropiedad(origen, 'Link') || '').trim(),
      InscripcionOnLine: String(obtenerPropiedad(origen, 'InscripcionOnLine') || '').trim(),
      Organizador: String(obtenerPropiedad(origen, 'Organizador') || '').trim(),
      Whatsapp: normalizarWhatsapp(obtenerPropiedad(origen, 'Whatsapp') || ''),
      Imagen: String(obtenerPropiedad(origen, 'Imagen') || '').trim(),
      ResolvedColor: String(obtenerPropiedad(origen, 'ResolvedColor') || '').trim(),
      Descripcion: String(obtenerPropiedad(origen, 'Descripcion') || '').trim(),
      VisibleEnCalendario: normalizarBoolean(obtenerPropiedad(origen, 'VisibleEnCalendario'), false)
    };
  }

  function obtenerIdEvento(evento) {
    return normalizarId(obtenerPropiedad(evento, 'Id'));
  }

  function obtenerClaveEventoCalendario(evento) {
    const id = obtenerIdEvento(evento);
    return id !== null ? String(id) : String(evento._localId || '');
  }

  function encontrarIndiceEventoPorId(id) {
    const normalizado = normalizarId(id);
    if (normalizado === null) {
      return -1;
    }
    return eventos.findIndex(ev => ev.Id === normalizado);
  }

  function buscarEventoPorClaveCalendario(clave) {
    return eventos.find(ev => obtenerClaveEventoCalendario(ev) === String(clave));
  }

  function guardarEventoLocal(evento) {
    const normalizado = crearEventoNormalizado(evento);
    const index = normalizado.Id !== null
      ? encontrarIndiceEventoPorId(normalizado.Id)
      : eventos.findIndex(ev => ev._localId === normalizado._localId);
    const anterior = index >= 0 ? eventos[index] : null;

    if (index >= 0) {
      eventos[index] = normalizado;
    } else {
      eventos.push(normalizado);
    }

    return { evento: normalizado, anterior: anterior };
  }

  function serializarEventoParaApi(ev) {
    return {
      Titulo: ev.Titulo,
      Fecha_Hora: ev.Fecha_Hora,
      Lugar: ev.Lugar,
      Estado: ev.Estado,
      Tipos: ev.Tipos,
      Distancias: ev.Distancias,
      Link: ev.Link,
      InscripcionOnLine: ev.InscripcionOnLine,
      Organizador: ev.Organizador,
      Whatsapp: ev.Whatsapp,
      Imagen: ev.Imagen,
      Descripcion: ev.Descripcion,
      VisibleEnCalendario: Boolean(ev.VisibleEnCalendario)
    };
  }

  function requiereRegenerarFiltros(eventoAnterior, eventoActual) {
    if (!eventoAnterior || !eventoActual) {
      return true;
    }

    return String(eventoAnterior.Tipos || '').trim() !== String(eventoActual.Tipos || '').trim() ||
      String(eventoAnterior.Lugar || '').trim() !== String(eventoActual.Lugar || '').trim() ||
      Boolean(eventoAnterior.VisibleEnCalendario) !== Boolean(eventoActual.VisibleEnCalendario);
  }

  function obtenerTiposArray(evento) {
    return String(evento.Tipos || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }

  function ordenarOpcionesTipo(opciones) {
    return opciones.sort((a, b) => {
      const aUpper = String(a).toUpperCase();
      const bUpper = String(b).toUpperCase();
      const prioridad = { MTB: 0, RUNNING: 1 };
      const pa = Object.prototype.hasOwnProperty.call(prioridad, aUpper) ? prioridad[aUpper] : 99;
      const pb = Object.prototype.hasOwnProperty.call(prioridad, bUpper) ? prioridad[bUpper] : 99;
      if (pa !== pb) {
        return pa - pb;
      }
      return a.localeCompare(b);
    });
  }

  function ordenarOpcionesLugar(opciones, conteo) {
    const topTres = opciones
      .slice()
      .sort((a, b) => {
        const diferencia = conteo[b] - conteo[a];
        return diferencia !== 0 ? diferencia : a.localeCompare(b);
      })
      .slice(0, 3);

    const resto = opciones
      .filter(opcion => !topTres.includes(opcion))
      .sort((a, b) => a.localeCompare(b));

    return topTres.concat(resto);
  }

  function obtenerColorPorTipos(tipos) {
    return obtenerColorFromResolvedColor(null);
  }

  function parseColorString(colorString) {
    if (!colorString || colorString.trim() === '') {
      return { backgroundColor: '#95E1D3', borderColor: '#76B8B0', textColor: '#ffffff' };
    }
    
    const parts = colorString.split(',').map(c => c.trim());
    
    if (parts.length === 3) {
      return {
        backgroundColor: parts[0] || '#95E1D3',
        borderColor: parts[1] || '#76B8B0',
        textColor: parts[2] || '#ffffff'
      };
    } else if (parts.length === 1 && parts[0]) {
      return {
        backgroundColor: parts[0],
        borderColor: parts[0],
        textColor: '#ffffff'
      };
    }
    
    return { backgroundColor: '#95E1D3', borderColor: '#76B8B0', textColor: '#ffffff' };
  }

  function obtenerColorFromResolvedColor(resolvedColor) {
    if (!resolvedColor || resolvedColor.trim() === '') {
      const config = (window.eventostriAdminV2Config && window.eventostriAdminV2Config.settings && window.eventostriAdminV2Config.settings.tipo_colors) 
        ? window.eventostriAdminV2Config.settings.tipo_colors 
        : {};
      resolvedColor = config.default_color || '#95E1D3,#76B8B0,#ffffff';
    }
    return parseColorString(resolvedColor);
  }

  function normalizarTextoBusqueda(valor) {
    const base = String(valor || '').toLowerCase().trim();
    if (typeof base.normalize === 'function') {
      return base.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    return base;
  }

  function escaparParaSelector(valor) {
    return String(valor || '')
      .split('\\').join('\\\\')
      .split('\"').join('\\\"');
  }

  function formatearFecha(fecha) {
    if (!fecha) return '';
    const fechaObj = new Date(fecha);
    if (Number.isNaN(fechaObj.getTime())) return String(fecha);

    const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'long' });
    const dia = fechaObj.toLocaleDateString('es-ES', { day: 'numeric' });
    const mes = fechaObj.toLocaleDateString('es-ES', { month: 'long' });
    const anio = fechaObj.toLocaleDateString('es-ES', { year: 'numeric' });
    const hora = fechaObj.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const diaSemanaFmt = diaSemana.replace(/(^|\s)([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])/gi, (m, e, l) => e + l.toUpperCase());
    const mesFmt = mes.replace(/(^|\s)([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])/gi, (m, e, l) => e + l.toUpperCase());

    return diaSemanaFmt + ', ' + dia + ' de ' + mesFmt + ' de ' + anio + ' · ' + hora;
  }

  function actualizarContador() {
    const contador = qs('contadorEventosV2');
    if (!contador) return;
    contador.textContent = eventos.length + (eventos.length === 1 ? ' evento' : ' eventos');
  }

  function generarCheckboxes(eventosBase, propiedad, contenedorId, seleccionados) {
    const contenedor = qs(contenedorId);
    if (!contenedor) return;

    const conteo = {};

    eventosBase.forEach(ev => {
      const valorRaw = String(ev[propiedad] || '').trim();
      if (!valorRaw || valorRaw === 'N/A') return;

      const partes = propiedad === 'Tipos'
        ? valorRaw.split(',')
        : valorRaw.split(/[,\/]/);

      partes
        .map(v => v.trim())
        .filter(Boolean)
        .forEach(v => {
          conteo[v] = (conteo[v] || 0) + 1;
        });
    });

    let opciones = Object.keys(conteo);
    if (propiedad === 'Tipos') {
      opciones = ordenarOpcionesTipo(opciones);
    } else {
      opciones = ordenarOpcionesLugar(opciones, conteo);
    }
    contenedor.innerHTML = '';

    opciones.forEach(opcion => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.innerHTML = '<input type="checkbox" value="' + escapeHtml(opcion) + '" style="margin-right:8px;"> <span>' + escapeHtml(opcion) + ' (' + conteo[opcion] + ')</span>';
      const check = label.querySelector('input');
      check.checked = seleccionados.has(opcion);

      check.addEventListener('change', () => {
        if (check.checked) {
          seleccionados.add(opcion);
        } else {
          seleccionados.delete(opcion);
        }
        renderCalendario();
      });

      contenedor.appendChild(label);
    });
  }

  function eventoPasaFiltros(ev) {
    const tipos = obtenerTiposArray(ev).map(v => v.toLowerCase());
    const lugar = String(ev.Lugar || '').toLowerCase();
    const titulo = String(ev.Titulo || '').toLowerCase();

    const pasaTipo = filtrosTipoSeleccionados.size === 0 || Array.from(filtrosTipoSeleccionados)
      .some(f => tipos.includes(f.toLowerCase()));
    const pasaLugar = filtrosLugarSeleccionados.size === 0 || Array.from(filtrosLugarSeleccionados)
      .some(f => lugar === f.toLowerCase());
    const pasaBusqueda = terminoBusquedaAdmin === '' || titulo.includes(terminoBusquedaAdmin);

    return pasaTipo && pasaLugar && pasaBusqueda;
  }

  function obtenerEventosFiltrados() {
    return eventos.filter(eventoPasaFiltros);
  }

  function mapearEventoParaCalendario(ev) {
    const tiposArray = obtenerTiposArray(ev);
    const resolvedColor = ev.ResolvedColor || ev.resolvedColor || '';
    const colores = obtenerColorFromResolvedColor(resolvedColor);
    const start = (ev.Fecha_Hora || '').trim();
    if (!start) {
      return null;
    }

    return {
      id: obtenerClaveEventoCalendario(ev),
      title: ev.Titulo || 'Evento deportivo',
      start: start,
      allDay: false,
      backgroundColor: colores.backgroundColor,
      borderColor: colores.borderColor,
      textColor: colores.textColor,
      extendedProps: {
        ...ev,
        tipos: tiposArray,
        ResolvedColor: resolvedColor,
        fechaFormateada: formatearFecha(ev.Fecha_Hora)
      }
    };
  }

  function mapearEventosParaCalendario(datos) {
    return datos
      .map(mapearEventoParaCalendario)
      .filter(Boolean);
  }

  function sincronizarEventoEnCalendario(eventoActual, eventoAnterior) {
    if (!calendarioInstancia) {
      renderCalendario();
      return;
    }

    const claveAnterior = eventoAnterior ? obtenerClaveEventoCalendario(eventoAnterior) : null;
    const claveActual = obtenerClaveEventoCalendario(eventoActual);
    const existente = calendarioInstancia.getEventById(claveAnterior || claveActual);
    if (existente) {
      existente.remove();
    }

    if (eventoPasaFiltros(eventoActual)) {
      const mapeado = mapearEventoParaCalendario(eventoActual);
      if (mapeado) {
        calendarioInstancia.addEvent(mapeado);
      }
    }

    aplicarDiasOcultosPorMes(obtenerEventosFiltrados());
    forzarRecalculoTamanoCalendario();
  }

  function removerEventoDelCalendario(eventoEliminado) {
    if (!calendarioInstancia) {
      renderCalendario();
      return;
    }

    const existente = calendarioInstancia.getEventById(obtenerClaveEventoCalendario(eventoEliminado));
    if (existente) {
      existente.remove();
    }

    aplicarDiasOcultosPorMes(obtenerEventosFiltrados());
    forzarRecalculoTamanoCalendario();
  }

  function calcularDiasAOcultar(eventosFiltrados, rangoVisible) {
    const diasSemanaOcultables = [1, 2, 3, 4, 5];
    const diasConEventos = new Set();

    eventosFiltrados.forEach(evento => {
      const fecha = String(evento.Fecha_Hora || '').split(/[T ]/)[0];
      const partes = fecha.split('-');
      if (partes.length !== 3) return;
      const fObj = new Date(partes[0], partes[1] - 1, partes[2]);
      if (!Number.isNaN(fObj.getTime())) {
        if (rangoVisible && (fObj < rangoVisible.inicio || fObj >= rangoVisible.fin)) {
          return;
        }
        diasConEventos.add(fObj.getDay());
      }
    });

    return diasSemanaOcultables.filter(dia => !diasConEventos.has(dia));
  }

  function mismoArregloDias(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  function forzarRecalculoTamanoCalendario() {
    if (!calendarioInstancia) return;
    requestAnimationFrame(() => {
      calendarioInstancia.updateSize();
      setTimeout(() => {
        if (calendarioInstancia) {
          calendarioInstancia.updateSize();
        }
      }, 180);
    });
  }

  function aplicarDiasOcultosPorMes(eventosFiltrados) {
    if (!calendarioInstancia) return;
    const hiddenDays = calcularDiasAOcultar(eventosFiltrados, rangoVisibleMes);
    const actuales = calendarioInstancia.getOption('hiddenDays') || [];
    if (!mismoArregloDias(actuales, hiddenDays)) {
      calendarioInstancia.setOption('hiddenDays', hiddenDays);
    }
  }

  function obtenerResultadosBusquedaAdminInline(termino) {
    const normalizado = normalizarTextoBusqueda(termino);
    if (!normalizado) {
      return [];
    }

    return eventos
      .filter(ev => normalizarTextoBusqueda(ev.Titulo || '').includes(normalizado))
      .slice(0, 10);
  }

  function enfocarEventoAdmin(evento) {
    if (!calendarioInstancia || !evento) return;

    if (evento.Fecha_Hora) {
      calendarioInstancia.gotoDate(evento.Fecha_Hora);
    }

    setTimeout(() => {
      if (!calendarioInstancia) return;
      const eventoCalendario = calendarioInstancia.getEventById(obtenerClaveEventoCalendario(evento));
      if (!eventoCalendario) return;
      const selector = '#calendario-admin-v2 .fc-event[data-event-id="' + escaparParaSelector(eventoCalendario.id) + '"]';
      const elemento = document.querySelector(selector);
      if (elemento) {
        elemento.classList.add('evento-busqueda-highlight');
        setTimeout(() => elemento.classList.remove('evento-busqueda-highlight'), 1800);
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      abrirModalEvento(evento);
    }, 180);
  }

  function inicializarBuscadorAdmin(searchInput, clearBtn, resultadosInline) {
    if (!searchInput || !clearBtn || !resultadosInline) {
      return;
    }

    let searchTimeout;
    let indiceActivo = -1;
    let resultados = [];
    let timeoutBlur = null;

    function actualizarUI() {
      clearBtn.style.display = terminoBusquedaAdmin ? 'inline-flex' : 'none';
    }

    function ocultarResultados() {
      resultadosInline.hidden = true;
      resultadosInline.innerHTML = '';
      resultados = [];
      indiceActivo = -1;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
    }

    function actualizarIndice(indiceNuevo) {
      const opciones = Array.from(resultadosInline.querySelectorAll('.evento-search-result-option'));
      if (opciones.length === 0) {
        indiceActivo = -1;
        searchInput.removeAttribute('aria-activedescendant');
        return;
      }
      indiceActivo = Math.max(0, Math.min(indiceNuevo, opciones.length - 1));
      opciones.forEach((opcion, i) => {
        const activo = i === indiceActivo;
        opcion.classList.toggle('is-active', activo);
        opcion.setAttribute('aria-selected', activo ? 'true' : 'false');
        if (activo) {
          searchInput.setAttribute('aria-activedescendant', opcion.id);
          opcion.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function seleccionarResultado(indice) {
      const evento = resultados[indice];
      if (!evento) return;
      searchInput.value = evento.Titulo || '';
      terminoBusquedaAdmin = normalizarTextoBusqueda(searchInput.value);
      actualizarUI();
      renderCalendario();
      ocultarResultados();
      enfocarEventoAdmin(evento);
    }

    function renderizarResultados() {
      const terminoVisible = String(searchInput.value || '').trim();
      resultadosInline.innerHTML = '';

      if (!terminoVisible) {
        ocultarResultados();
        return;
      }

      resultados = obtenerResultadosBusquedaAdminInline(terminoVisible);
      if (resultados.length === 0) {
        const li = document.createElement('li');
        li.className = 'evento-search-inline-empty';
        li.textContent = 'No hay eventos coincidentes.';
        resultadosInline.appendChild(li);
        resultadosInline.hidden = false;
        searchInput.setAttribute('aria-expanded', 'true');
        return;
      }

      resultados.forEach((evento, indice) => {
        const li = document.createElement('li');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.id = 'evento-search-admin-option-' + indice;
        boton.className = 'evento-search-result-option';
        boton.setAttribute('role', 'option');
        boton.setAttribute('aria-selected', 'false');
        boton.innerHTML = '<span class="evento-search-result-title"></span><span class="evento-search-result-meta"></span>';
        boton.querySelector('.evento-search-result-title').textContent = evento.Titulo || 'Evento deportivo';
        boton.querySelector('.evento-search-result-meta').textContent = formatearFecha(evento.Fecha_Hora) || 'Fecha pendiente';
        boton.addEventListener('mouseenter', () => actualizarIndice(indice));
        boton.addEventListener('click', () => seleccionarResultado(indice));
        li.appendChild(boton);
        resultadosInline.appendChild(li);
      });

      resultadosInline.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      actualizarIndice(0);
    }

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        terminoBusquedaAdmin = normalizarTextoBusqueda(e.target.value || '');
        actualizarUI();
        renderCalendario();
        renderizarResultados();
      }, 220);
    });

    searchInput.addEventListener('focus', () => {
      if (timeoutBlur) {
        clearTimeout(timeoutBlur);
        timeoutBlur = null;
      }
      if (String(searchInput.value || '').trim()) {
        renderizarResultados();
      }
    });

    searchInput.addEventListener('blur', () => {
      timeoutBlur = setTimeout(() => {
        ocultarResultados();
      }, 140);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        if (resultadosInline.hidden) {
          renderizarResultados();
        }
        if (resultados.length > 0) {
          e.preventDefault();
          actualizarIndice(indiceActivo + 1);
        }
        return;
      }
      if (e.key === 'ArrowUp' && resultados.length > 0) {
        e.preventDefault();
        actualizarIndice(indiceActivo - 1);
        return;
      }
      if (e.key === 'Enter' && indiceActivo >= 0 && resultados.length > 0) {
        e.preventDefault();
        seleccionarResultado(indiceActivo);
        return;
      }
      if (e.key === 'Escape') {
        searchInput.value = '';
        terminoBusquedaAdmin = '';
        actualizarUI();
        renderCalendario();
        ocultarResultados();
      }
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      terminoBusquedaAdmin = '';
      actualizarUI();
      ocultarResultados();
      searchInput.focus();
      renderCalendario();
    });

    actualizarUI();
  }

  function renderCalendario() {
    const contenedorEl = qs('calendario-admin-v2');
    if (!contenedorEl || !window.FullCalendar) return;

    const filtrados = obtenerEventosFiltrados();
    const eventosMapeados = mapearEventosParaCalendario(filtrados);

    if (!calendarioInstancia) {
      calendarioInstancia = new FullCalendar.Calendar(contenedorEl, {
        initialView: 'dayGridMonth',
        handleWindowResize: true,
        height: 'auto',
        contentHeight: 'auto',
        expandRows: true,
        locale: 'es',
        titleFormat: { year: 'numeric', month: 'short' },
        hiddenDays: calcularDiasAOcultar(filtrados, rangoVisibleMes),
        buttonText: {
          today: 'Hoy',
          dayGridMonth: 'Mes',
          timeGridWeek: 'Semana',
          listMonth: 'Lista'
        },
        headerToolbar: {
          start: 'prev',
          center: 'title',
          end: 'next'
        },
        footerToolbar: {
          start: 'today',
          end: 'dayGridMonth,timeGridWeek,listMonth'
        },
        eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: false, hour12: false, omitZeroMinute: true },
        events: eventosMapeados,
        eventDidMount: function(info) {
          const extendedProps = info.event.extendedProps || {};
          const resolvedColor = extendedProps.resolvedColor || extendedProps.ResolvedColor || '';
          const colores = obtenerColorFromResolvedColor(resolvedColor);
          const el = info.el;
          if (!el) return;

          el.style.backgroundColor = colores.backgroundColor;
          el.style.borderColor = colores.borderColor;
          el.style.color = colores.textColor;
          el.style.opacity = '1';
          el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.12)';

          const title = el.querySelector('.fc-event-title');
          if (title) {
            title.style.color = colores.textColor;
          }
        },
        eventClick: function(info) {
          info.jsEvent.preventDefault();
          const local = buscarEventoPorClaveCalendario(info.event.id);
          if (local) {
            abrirModalEvento(local);
          }
        },
        dateClick: function(info) {
          const fechaBase = info.dateStr ? (info.dateStr + 'T08:00') : '';
          abrirModalEvento(crearEventoNormalizado({ Fecha_Hora: fechaBase, Estado: 'YUC' }), true);
        },
        datesSet: function(info) {
          rangoVisibleMes = { inicio: new Date(info.start), fin: new Date(info.end) };
          aplicarDiasOcultosPorMes(obtenerEventosFiltrados());
          forzarRecalculoTamanoCalendario();
        }
      });

      calendarioInstancia.render();
      inicializarNavegacionSwipeAdmin(contenedorEl);
      forzarRecalculoTamanoCalendario();
      window.addEventListener('resize', forzarRecalculoTamanoCalendario);
      window.addEventListener('load', forzarRecalculoTamanoCalendario);
      return;
    }

    aplicarDiasOcultosPorMes(filtrados);
    calendarioInstancia.removeAllEvents();
    calendarioInstancia.addEventSource(eventosMapeados);
    forzarRecalculoTamanoCalendario();
  }

  function abrirModal() {
    const modal = qs('modal-admin-v2');
    if (!modal) return;
    const yaAbierto = modal.classList.contains('is-open');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if (!yaAbierto) {
      registrarModalAdminEnHistorial('modal-admin-v2');
    }
  }

  function deshabilitarAccionesModal(deshabilitar) {
    const btnGuardar = qs('btnGuardarEventoV2');
    const btnEliminar = qs('btnEliminarEventoV2');
    const btnCancelar = qs('btnCancelarModalV2');
    if (btnGuardar) btnGuardar.disabled = deshabilitar;
    if (btnEliminar) btnEliminar.disabled = deshabilitar;
    if (btnCancelar) btnCancelar.disabled = deshabilitar;
  }

  function cerrarModal(desdePopstate) {
    const modal = qs('modal-admin-v2');
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    removerModalAdminEnHistorial('modal-admin-v2', Boolean(desdePopstate));
    deshabilitarAccionesModal(false);
    mostrarMensaje('', 'info');
    const msg = qs('mensajeEstadoV2');
    if (msg) msg.className = 'mensaje-estado';
  }

  function actualizarVistaPreviaImagen() {
    const input = qs('fImagenV2');
    const preview = qs('previewImagenV2');
    const empty = qs('previewImagenV2Empty');
    if (!input || !preview) return;

    const url = String(input.value || '').trim();
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
      if (empty) {
        empty.style.display = 'none';
      }
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      if (empty) {
        empty.style.display = 'block';
      }
    }
  }

  function cargarFormulario(evento, creando = false) {
    qs('modalTitleV2').textContent = creando ? etiquetaNuevoEvento : 'Editar evento';
    qs('modalSubtitleV2').textContent = creando
      ? 'Completa los campos para crear el evento.'
      : 'Actualiza campos o elimina el evento seleccionado.';

    qs('fTituloV2').value = evento.Titulo || '';
    qs('fFechaV2').value = normalizarFechaLocal(evento.Fecha_Hora || '');
    qs('fEstadoV2').value = evento.Estado || 'YUC';
    qs('fLugarV2').value = evento.Lugar || '';
    qs('fTiposV2').value = evento.Tipos || '';
    qs('fDistanciasV2').value = evento.Distancias || '';
    qs('fLinkV2').value = evento.Link || '';
    qs('fInscripcionOnLineV2').value = evento.InscripcionOnLine || '';
    qs('fOrganizadorV2').value = evento.Organizador || '';
    qs('fWhatsappV2').value = evento.Whatsapp || '';
    qs('fImagenV2').value = evento.Imagen || '';
    qs('fDescripcionV2').value = evento.Descripcion || '';
    qs('fVisibleEnCalendarioV2').checked = Boolean(evento.VisibleEnCalendario);
    actualizarVistaPreviaImagen();

    const btnEliminar = qs('btnEliminarEventoV2');
    if (btnEliminar) {
      btnEliminar.style.display = creando ? 'none' : 'inline-block';
    }
  }

  function abrirModalEvento(evento, creando = false) {
    const normalizado = crearEventoNormalizado(evento);
    editandoId = creando ? null : normalizado.Id;
    cargarFormulario(normalizado, creando);
    abrirModal();
  }

  function leerEventoDesdeFormulario() {
    return crearEventoNormalizado({
      Id: editandoId,
      _localId: editandoId ? ('wp-' + editandoId) : crypto.randomUUID(),
      Titulo: qs('fTituloV2').value,
      Fecha_Hora: qs('fFechaV2').value,
      Estado: qs('fEstadoV2').value,
      Lugar: qs('fLugarV2').value,
      Tipos: qs('fTiposV2').value,
      Distancias: qs('fDistanciasV2').value,
      Link: qs('fLinkV2').value,
      InscripcionOnLine: qs('fInscripcionOnLineV2').value,
      Organizador: qs('fOrganizadorV2').value,
      Whatsapp: qs('fWhatsappV2').value,
      Imagen: qs('fImagenV2').value,
      Descripcion: qs('fDescripcionV2').value,
      VisibleEnCalendario: qs('fVisibleEnCalendarioV2').checked
    });
  }

  async function crearEventoWordPressAPI(evento) {
    const data = await enviarSolicitudJsonAutenticada(
      apiEventosUrl,
      {
        method: 'POST',
        body: JSON.stringify(serializarEventoParaApi(evento))
      },
      'Error al crear evento en WordPress'
    );

    if (!data || !data.evento) {
      registrarLog('La API no devolvio el evento creado.', 'error');
      return null;
    }

    registrarLog('Evento agregado: ' + (data.evento.Titulo || evento.Titulo), 'success');
    return crearEventoNormalizado(data.evento);
  }

  async function actualizarEventoWordPressAPI(evento) {
    if (evento.Id === null) {
      registrarLog('No se puede actualizar un evento sin Id persistido.', 'error');
      return null;
    }

    const data = await enviarSolicitudJsonAutenticada(
      construirUrlEventoPorId(evento.Id),
      {
        method: 'PUT',
        body: JSON.stringify(serializarEventoParaApi(evento))
      },
      'Error al actualizar evento en WordPress'
    );

    if (!data || !data.evento) {
      registrarLog('La API no devolvio el evento actualizado.', 'error');
      return null;
    }

    registrarLog('Evento actualizado: ' + (data.evento.Titulo || evento.Titulo), 'success');
    return crearEventoNormalizado(data.evento);
  }

  async function eliminarEventoWordPressAPI(evento) {
    if (!evento || evento.Id === null) {
      registrarLog('No se puede eliminar un evento sin Id persistido.', 'error');
      return null;
    }

    const data = await enviarSolicitudJsonAutenticada(
      construirUrlEventoPorId(evento.Id),
      { method: 'DELETE' },
      'Error al eliminar evento en WordPress'
    );

    if (!data || normalizarId(data.deleted_id) === null) {
      registrarLog('La API no confirmo la eliminacion del evento.', 'error');
      return null;
    }

    registrarLog('Evento eliminado: ' + (evento.Titulo || 'evento'), 'warning');
    return normalizarId(data.deleted_id);
  }

  async function guardarEventoDesdeModal(e) {
    e.preventDefault();

    if (sincronizacionEnCurso) {
      mostrarMensaje('La sincronizacion anterior sigue en progreso. Espera unos segundos.', 'warning');
      return;
    }

    const evento = leerEventoDesdeFormulario();
    if (!evento.Titulo) {
      mostrarMensaje('El titulo del evento es obligatorio.', 'error');
      qs('fTituloV2').focus();
      return;
    }
    if (!evento.Fecha_Hora) {
      mostrarMensaje('La fecha y hora son obligatorias.', 'error');
      qs('fFechaV2').focus();
      return;
    }

    const eventoAnterior = evento.Id !== null
      ? eventos.find(ev => ev.Id === evento.Id) || null
      : null;

    deshabilitarAccionesModal(true);
    const guardado = evento.Id !== null
      ? await actualizarEventoWordPressAPI(evento)
      : await crearEventoWordPressAPI(evento);

    if (!guardado) {
      return;
    }

    const resultado = guardarEventoLocal(guardado);
    cerrarModal();
    actualizarContador();
    if (!resultado.anterior || requiereRegenerarFiltros(resultado.anterior, resultado.evento)) {
      generarFiltros();
    }
    sincronizarEventoEnCalendario(resultado.evento, resultado.anterior || eventoAnterior);
  }

  async function eliminarEventoActual() {
    if (sincronizacionEnCurso) {
      mostrarMensaje('La sincronizacion anterior sigue en progreso. Espera unos segundos.', 'warning');
      return;
    }

    if (editandoId === null) {
      return;
    }

    const index = encontrarIndiceEventoPorId(editandoId);
    if (index < 0) {
      return;
    }

    const eventoActual = eventos[index];
    if (!confirm('¿Deseas eliminar este evento?')) {
      return;
    }

    deshabilitarAccionesModal(true);
    const deletedId = await eliminarEventoWordPressAPI(eventoActual);
    if (deletedId === null) {
      return;
    }

    eventos.splice(index, 1);
    cerrarModal();
    editandoId = null;
    actualizarContador();
    generarFiltros();
    removerEventoDelCalendario(eventoActual);
  }

  function generarFiltros() {
    generarCheckboxes(eventos, 'Tipos', 'filtro-tipo-container-v2', filtrosTipoSeleccionados);
    generarCheckboxes(eventos, 'Lugar', 'filtro-lugar-container-v2', filtrosLugarSeleccionados);
  }

  function parseCsvConLineas(textoCsv) {
    const filas = [];
    let valor = '';
    let fila = [];
    let enComillas = false;
    let linea = 1;
    let lineaInicialFila = 1;

    function pushFila() {
      if (fila.length === 1 && String(fila[0] || '').trim() === '') {
        fila = [];
        return;
      }
      filas.push({ values: fila.slice(), lineNumber: lineaInicialFila });
      fila = [];
    }

    for (let i = 0; i < textoCsv.length; i++) {
      const char = textoCsv[i];
      const siguiente = textoCsv[i + 1];

      if (char === '"') {
        if (enComillas && siguiente === '"') {
          valor += '"';
          i++;
        } else {
          enComillas = !enComillas;
        }
        continue;
      }

      if (!enComillas && (char === ',' || char === ';')) {
        fila.push(valor);
        valor = '';
        continue;
      }

      if (!enComillas && (char === '\n' || char === '\r')) {
        if (char === '\r' && siguiente === '\n') {
          i++;
        }
        fila.push(valor);
        valor = '';
        pushFila();
        linea++;
        lineaInicialFila = linea;
        continue;
      }

      valor += char;
    }

    if (valor !== '' || fila.length > 0) {
      fila.push(valor);
      pushFila();
    }

    return filas;
  }

  function dedupeKeyEvento(titulo, fechaHora, lugar) {
    return String(titulo || '').trim().toLowerCase() + '|' +
      String(fechaHora || '').trim() + '|' +
      String(lugar || '').trim().toLowerCase();
  }

  async function importarEventosWordPressAPI(eventosImportar) {
    const data = await enviarSolicitudJsonAutenticada(
      apiEventosImportUrl,
      {
        method: 'POST',
        body: JSON.stringify({ eventos: eventosImportar.map(serializarEventoParaApi) })
      },
      'Error al importar eventos en WordPress'
    );

    if (!data || !Array.isArray(data.eventos)) {
      registrarLog('La API no devolvio el resultado esperado de importacion.', 'error');
      return null;
    }

    return data;
  }

  async function importarCsvAdmin() {
    if (sincronizacionEnCurso) {
      registrarLog('Sincronización en curso. Espera para importar.', 'warning');
      return;
    }

    const inputCsv = qs('inputCsvV2');
    if (!inputCsv || !inputCsv.files || !inputCsv.files[0]) {
      registrarLog('No se seleccionó archivo CSV para importar.', 'warning');
      return;
    }

    const archivo = inputCsv.files[0];
    const textoCsv = await archivo.text();
    const filas = parseCsvConLineas(textoCsv);
    if (filas.length < 2) {
      registrarLog('El CSV no contiene filas para importar.', 'warning');
      return;
    }

    const encabezados = filas[0].values.map(h => String(h || '').trim());
    const idx = {};
    encabezados.forEach((h, i) => { idx[h] = i; });

    const requeridos = ['Titulo', 'Fecha_Hora'];
    const faltantes = requeridos.filter(campo => !Object.prototype.hasOwnProperty.call(idx, campo));
    if (faltantes.length > 0) {
      registrarLog('CSV inválido. Faltan columnas: ' + faltantes.join(', '), 'error');
      return;
    }

    const existentes = new Set(eventos.map(ev => dedupeKeyEvento(ev.Titulo, ev.Fecha_Hora, ev.Lugar)));
    const vistosEnCsv = new Set();
    const lineasDuplicadas = [];
    const eventosAImportar = [];
    let invalidos = 0;

    for (let i = 1; i < filas.length; i++) {
      const filaInfo = filas[i];
      const row = filaInfo.values;
      const get = function(col) {
        const pos = idx[col];
        return pos === undefined ? '' : String(row[pos] || '').trim();
      };

      const titulo = get('Titulo');
      const fechaHora = get('Fecha_Hora');
      const lugar = get('Lugar');
      const key = dedupeKeyEvento(titulo, fechaHora, lugar);

      if (!titulo || !fechaHora) {
        invalidos++;
        continue;
      }

      if (existentes.has(key) || vistosEnCsv.has(key)) {
        lineasDuplicadas.push(filaInfo.lineNumber);
        continue;
      }

      vistosEnCsv.add(key);
      eventosAImportar.push(crearEventoNormalizado({
        Titulo: titulo,
        Fecha_Hora: fechaHora,
        Lugar: lugar,
        Estado: get('Estado') || 'YUC',
        Tipos: get('Tipos'),
        Distancias: get('Distancias'),
        Link: get('Link'),
        Imagen: get('Imagen'),
        Descripcion: get('Descripcion'),
        Whatsapp: get('Whatsapp'),
        InscripcionOnLine: get('InscripcionOnLine'),
        Organizador: get('Organizador'),
        VisibleEnCalendario: Object.prototype.hasOwnProperty.call(idx, 'VisibleEnCalendario')
          ? normalizarBoolean(get('VisibleEnCalendario'), false)
          : false
      }));
    }

    if (eventosAImportar.length === 0) {
      registrarLog(
        'Importación CSV sin nuevos eventos. Duplicados: ' + lineasDuplicadas.length + ' | Inválidos: ' + invalidos,
        lineasDuplicadas.length > 0 || invalidos > 0 ? 'warning' : 'info'
      );
      return;
    }

    const resultado = await importarEventosWordPressAPI(eventosAImportar);
    if (!resultado) {
      registrarLog('Importación CSV finalizada sin sincronización completa.', 'warning');
      return;
    }

    resultado.eventos.forEach(item => {
      guardarEventoLocal(item);
    });

    actualizarContador();
    generarFiltros();
    renderCalendario();
    registrarLog(
      'Importación CSV completada. Insertados: ' + (resultado.insertados ?? resultado.eventos.length) +
      ' | Duplicados cliente: ' + lineasDuplicadas.length +
      ' | Duplicados servidor: ' + (resultado.omitidos_duplicados ?? 0) +
      ' | Inválidos: ' + invalidos +
      (lineasDuplicadas.length ? ' | Líneas duplicadas: ' + lineasDuplicadas.join(', ') : ''),
      lineasDuplicadas.length > 0 || invalidos > 0 || (resultado.omitidos_duplicados ?? 0) > 0 ? 'warning' : 'success'
    );
  }

  async function eliminarEventosPasadosWordPressAPI() {
    const data = await enviarSolicitudJsonAutenticada(
      apiEventosDeletePastUrl,
      {
        method: 'POST',
        body: JSON.stringify({})
      },
      'Error al eliminar eventos pasados en WordPress'
    );

    if (!data || !Array.isArray(data.deleted_ids)) {
      registrarLog('La API no devolvio el resultado esperado para eliminar eventos pasados.', 'error');
      return null;
    }

    return data;
  }

  async function eliminarEventosPasados() {
    if (sincronizacionEnCurso) {
      registrarLog('Sincronización en curso. Espera para eliminar eventos pasados.', 'warning');
      return;
    }

    const totalPasados = eventos.filter(esEventoPasado).length;
    if (totalPasados === 0) {
      registrarLog('No hay eventos pasados para eliminar.', 'info');
      return;
    }

    if (!confirm('Se eliminarán ' + totalPasados + ' evento(s) pasado(s). ¿Deseas continuar?')) {
      return;
    }

    const resultado = await eliminarEventosPasadosWordPressAPI();
    if (!resultado) {
      registrarLog('Eliminación de pasados finalizada sin sincronización completa.', 'warning');
      return;
    }

    const deletedIds = new Set((resultado.deleted_ids || []).map(id => normalizarId(id)).filter(id => id !== null));
    eventos = eventos.filter(ev => ev.Id === null || !deletedIds.has(ev.Id));
    actualizarContador();
    generarFiltros();
    renderCalendario();
    registrarLog('Eventos pasados eliminados: ' + (resultado.deleted_count ?? deletedIds.size), 'success');
  }

  async function cargarDesdeWordPressAPI() {
    registrarLog('Solicitando eventos desde WordPress API...', 'info');

    try {
      const res = await fetch(apiEventosUrl + '?_ts=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (!res.ok) {
        throw new Error('No se pudo leer la API de WordPress. HTTP ' + res.status);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('La API devolvio un formato invalido.');
      }

      eventos = data.map(item => crearEventoNormalizado(item));
      actualizarContador();
      generarFiltros();
      renderCalendario();
      registrarLog('Carga completada. Eventos recibidos: ' + eventos.length, 'success');
    } catch (err) {
      registrarLog('Error al cargar eventos: ' + err.message, 'error');
    }
  }

  
  function vincularEventosUI() {
    const btnCargar = qs('btnCargarApiV2');
    const btnImportarCsv = qs('btnImportarCsvV2');
    const btnExportarCsv = qs('btnExportarCsvV2');
    const btnEliminarPasados = qs('btnEliminarPasadosV2');
    const btnNuevo = qs('btnNuevoEventoV2');
    const btnVerificar = qs('btnVerificarSesionV2');
    const btnLimpiarLog = qs('btnLimpiarLogV2');
    const btnCerrar = qs('btnCerrarModalV2');
    const btnCancelarModal = qs('btnCancelarModalV2');
    const btnEliminar = qs('btnEliminarEventoV2');
    const inputCsv = qs('inputCsvV2');
    const form = qs('formEventoV2');
    const modal = qs('modal-admin-v2');
    const searchInput = qs('evento-search-input-admin-v2');
    const clearSearchBtn = qs('clear-search-admin-v2');
    const searchResults = qs('evento-search-inline-results-admin-v2');

    if (!btnCargar || !btnNuevo || !btnVerificar || !form || !modal) {
      setTimeout(vincularEventosUI, 200);
      return;
    }

    btnCargar.addEventListener('click', cargarDesdeWordPressAPI);
    if (btnImportarCsv && inputCsv) {
      btnImportarCsv.addEventListener('click', () => {
        inputCsv.value = '';
        inputCsv.click();
      });
      inputCsv.addEventListener('change', importarCsvAdmin);
    }
    if (btnExportarCsv) {
      btnExportarCsv.addEventListener('click', () => {
        if (!apiExportCsvUrl) {
          registrarLog('No se encontro la URL de exportacion CSV.', 'error');
          return;
        }
        window.location.href = apiExportCsvUrl;
      });
    }
    if (btnEliminarPasados) {
      btnEliminarPasados.addEventListener('click', eliminarEventosPasados);
    }
    btnNuevo.addEventListener('click', () => abrirModalEvento(crearEventoNormalizado({ Estado: 'YUC' }), true));
    btnVerificar.addEventListener('click', () => verificarSesionWordPressAPI(false));
    form.addEventListener('submit', guardarEventoDesdeModal);

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
    if (btnCancelarModal) btnCancelarModal.addEventListener('click', cerrarModal);
    if (btnEliminar) btnEliminar.addEventListener('click', eliminarEventoActual);
    const inputImagen = qs('fImagenV2');
    if (inputImagen) {
      inputImagen.addEventListener('input', actualizarVistaPreviaImagen);
      inputImagen.addEventListener('change', actualizarVistaPreviaImagen);
    }
    if (btnLimpiarLog) {
      btnLimpiarLog.addEventListener('click', () => {
        const contenedor = qs('apiLogListV2');
        if (contenedor) contenedor.innerHTML = '';
        registrarLog('Registro limpiado por el usuario.', 'info');
      });
    }

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        cerrarModal();
      }
    });

    inicializarBackGestureModalAdmin();
    inicializarBuscadorAdmin(searchInput, clearSearchBtn, searchResults);
    actualizarBanderaSesionUI();
    registrarLog('Panel v2 cargado. Verificando sesion automaticamente...', 'info');
    verificarSesionWordPressAPI(true).then(() => {
      const tipo = (estadoSesionWP.autenticado && estadoSesionWP.puedeGuardar) ? 'success' : 'warning';
      registrarLog('Verificacion inicial: ' + estadoSesionWP.usuarioTexto + ' | ' + estadoSesionWP.detalle, tipo);
    });

    cargarDesdeWordPressAPI();
  }

  function esperarFullCalendarYArrancar() {
    if (window.FullCalendar) {
      vincularEventosUI();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js';
    script.onload = vincularEventosUI;
    document.head.appendChild(script);
  }

  function asegurarCssFullCalendar() {
    const id = 'fullcalendar-css-eventostri-admin-v2';
    if (document.getElementById(id)) {
      return;
    }
    const css = document.createElement('link');
    css.id = id;
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css';
    document.head.appendChild(css);
  }

  function init() {
    asegurarCssFullCalendar();
    esperarFullCalendarYArrancar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





