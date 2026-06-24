(function() {
  if (window.__eventosAdminV2Inicializado) {
    return;
  }
  window.__eventosAdminV2Inicializado = true;

  const apiEventosUrl = '/wp-json/eventostri/v1/eventos';
  const apiSyncUrl = '/wp-json/eventostri/v1/eventos/sync';
  const apiAuthStatusUrl = '/wp-json/eventostri/v1/auth-status';
  const apiExportCsvUrl = (window.eventostriAdminV2Config && window.eventostriAdminV2Config.exportCsvUrl)
    ? window.eventostriAdminV2Config.exportCsvUrl
    : '';

  let eventos = [];
  let calendarioInstancia = null;
  let nonceRestCache = '';
  let editandoId = null;
  let sincronizacionEnCurso = false;
  let filtrosTipoSeleccionados = new Set();
  let filtrosLugarSeleccionados = new Set();
  let rangoVisibleMes = null;

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
    return {
      _localId: origen._localId || crypto.randomUUID(),
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
      Descripcion: String(obtenerPropiedad(origen, 'Descripcion') || '').trim(),
      VisibleEnCalendario: normalizarBoolean(obtenerPropiedad(origen, 'VisibleEnCalendario'), false)
    };
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
    const texto = tipos.map(t => t.toLowerCase());
    if (texto.some(t => t.includes('mtb'))) {
      return {
        backgroundColor: '#ffe2d7',
        borderColor: '#f5a283',
        textColor: '#9a3f1f'
      };
    }
    if (texto.some(t => t.includes('running'))) {
      return {
        backgroundColor: '#dfeeff',
        borderColor: '#86b9ff',
        textColor: '#0d4c9a'
      };
    }
    return {
      backgroundColor: '#ece8ff',
      borderColor: '#b6a7ff',
      textColor: '#5a45c7'
    };
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

  function obtenerEventosFiltrados() {
    return eventos.filter(ev => {
      const tipos = obtenerTiposArray(ev).map(v => v.toLowerCase());
      const lugar = String(ev.Lugar || '').toLowerCase();

      const pasaTipo = filtrosTipoSeleccionados.size === 0 || Array.from(filtrosTipoSeleccionados)
        .some(f => tipos.includes(f.toLowerCase()));
      const pasaLugar = filtrosLugarSeleccionados.size === 0 || Array.from(filtrosLugarSeleccionados)
        .some(f => lugar === f.toLowerCase());

      return pasaTipo && pasaLugar;
    });
  }

  function mapearEventosParaCalendario(datos) {
    return datos
      .map(ev => {
        const tiposArray = obtenerTiposArray(ev);
        const colores = obtenerColorPorTipos(tiposArray);

        return {
          id: ev._localId,
          title: ev.Titulo || 'Evento deportivo',
          start: (ev.Fecha_Hora || '').trim() || null,
          allDay: false,
          backgroundColor: colores.backgroundColor,
          borderColor: colores.borderColor,
          textColor: colores.textColor,
          extendedProps: {
            ...ev,
            tipos: tiposArray,
            fechaFormateada: formatearFecha(ev.Fecha_Hora)
          }
        };
      })
      .filter(e => e.start !== null);
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
          const colores = obtenerColorPorTipos(info.event.extendedProps?.tipos || []);
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
          const local = eventos.find(ev => ev._localId === info.event.id);
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
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function deshabilitarAccionesModal(deshabilitar) {
    const btnGuardar = qs('btnGuardarEventoV2');
    const btnEliminar = qs('btnEliminarEventoV2');
    const btnCancelar = qs('btnCancelarModalV2');
    if (btnGuardar) btnGuardar.disabled = deshabilitar;
    if (btnEliminar) btnEliminar.disabled = deshabilitar;
    if (btnCancelar) btnCancelar.disabled = deshabilitar;
  }

  function cerrarModal() {
    const modal = qs('modal-admin-v2');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
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
    qs('modalTitleV2').textContent = creando ? 'Nuevo evento' : 'Editar evento';
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
    editandoId = creando ? null : normalizado._localId;
    cargarFormulario(normalizado, creando);
    abrirModal();
  }

  function leerEventoDesdeFormulario() {
    return crearEventoNormalizado({
      _localId: editandoId || crypto.randomUUID(),
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

    if (editandoId) {
      const index = eventos.findIndex(ev => ev._localId === editandoId);
      if (index >= 0) {
        eventos[index] = evento;
      }
      registrarLog('Evento actualizado: ' + evento.Titulo, 'success');
    } else {
      eventos.push(evento);
      registrarLog('Evento agregado: ' + evento.Titulo, 'success');
    }

    deshabilitarAccionesModal(true);
    const sincronizado = await sincronizarEnWordPressAPI();
    cerrarModal();

    if (!sincronizado) {
      registrarLog('Guardado finalizado sin sincronizacion completa.', 'warning');
      return;
    }

    actualizarContador();
    generarFiltros();
    renderCalendario();
  }

  async function eliminarEventoActual() {
    if (sincronizacionEnCurso) {
      mostrarMensaje('La sincronizacion anterior sigue en progreso. Espera unos segundos.', 'warning');
      return;
    }

    if (!editandoId) {
      return;
    }

    const index = eventos.findIndex(ev => ev._localId === editandoId);
    if (index < 0) {
      return;
    }

    const nombre = eventos[index].Titulo || 'evento';
    if (!confirm('¿Deseas eliminar este evento?')) {
      return;
    }

    eventos.splice(index, 1);
    registrarLog('Evento eliminado: ' + nombre, 'warning');

    deshabilitarAccionesModal(true);
    const sincronizado = await sincronizarEnWordPressAPI();
    cerrarModal();

    if (!sincronizado) {
      registrarLog('Eliminacion finalizada sin sincronizacion completa.', 'warning');
      return;
    }

    editandoId = null;
    actualizarContador();
    generarFiltros();
    renderCalendario();
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
    let insertados = 0;
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
      eventos.push(crearEventoNormalizado({
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
      insertados++;
    }

    const sincronizado = await sincronizarEnWordPressAPI();
    if (!sincronizado) {
      registrarLog('Importación CSV finalizada sin sincronización completa.', 'warning');
      return;
    }

    actualizarContador();
    generarFiltros();
    renderCalendario();
    registrarLog(
      'Importación CSV completada. Insertados: ' + insertados +
      ' | Duplicados: ' + lineasDuplicadas.length +
      ' | Inválidos: ' + invalidos +
      (lineasDuplicadas.length ? ' | Líneas duplicadas: ' + lineasDuplicadas.join(', ') : ''),
      lineasDuplicadas.length > 0 || invalidos > 0 ? 'warning' : 'success'
    );
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

    eventos = eventos.filter(ev => !esEventoPasado(ev));
    const sincronizado = await sincronizarEnWordPressAPI();
    if (!sincronizado) {
      registrarLog('Eliminación de pasados finalizada sin sincronización completa.', 'warning');
      return;
    }

    actualizarContador();
    generarFiltros();
    renderCalendario();
    registrarLog('Eventos pasados eliminados: ' + totalPasados, 'success');
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

  async function sincronizarEnWordPressAPI() {
    if (sincronizacionEnCurso) {
      registrarLog('Sincronizacion ya en curso. Esperando a que termine...', 'warning');
      return false;
    }

    if (eventos.length === 0) {
      alert('No hay eventos en la lista para subir.');
      return false;
    }

    const estado = await verificarSesionWordPressAPI(true);
    if (!estado.autenticado || !estado.puedeGuardar) {
      registrarLog('Bloqueado guardado por sesion/permisos: ' + estado.detalle, 'warning');
      actualizarBanderaSesionUI();
      return false;
    }

    const nonce = obtenerNonceRest();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }

    const payload = eventos.map(ev => ({
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
    }));

    sincronizacionEnCurso = true;
    try {
      registrarLog('Enviando sincronizacion con ' + payload.length + ' eventos...', 'info');
      const res = await fetch(apiSyncUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('No autorizado para guardar. Inicia sesion y verifica nonce REST.');
        }
        throw new Error('Error al guardar en WordPress. HTTP ' + res.status);
      }

      const data = await res.json();
      if (!data || data.ok !== true) {
        throw new Error('La API respondio sin confirmar la sincronizacion.');
      }

      registrarLog('Sincronizacion completada. Insertados: ' + (data.insertados ?? 'n/d'), 'success');
      return true;
    } catch (err) {
      registrarLog('Error al sincronizar: ' + err.message, 'error');
      return false;
    } finally {
      sincronizacionEnCurso = false;
      deshabilitarAccionesModal(false);
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
