(function(){
  // Administrador de eventos para Eventostri.org
  // id 352
  let eventos = [];
  let colActual = '';
  let ordenAsc = true;
  let indiceEditando = -1;
  const apiEventosUrl = '/wp-json/eventostri/v1/eventos';
  const apiSyncUrl = '/wp-json/eventostri/v1/eventos/sync';
  const apiAuthStatusUrl = '/wp-json/eventostri/v1/auth-status';
  let nonceRestCache = '';
  const estadoSesionWP = {
    verificado: false,
    autenticado: false,
    puedeGuardar: false,
    tieneNonce: false,
    usuarioTexto: 'No detectado',
    detalle: 'Sin verificacion'
  };

  function mostrarMensaje(texto, tipo = 'info') {
    const msg = document.getElementById('mensajeEstado');
    if (!msg) return;
    msg.textContent = texto;
    msg.className = 'mensaje-estado ' + tipo;
    if (tipo === 'success' || tipo === 'warning' || tipo === 'error') {
      msg.dataset.timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      msg.title = 'Última actualización: ' + msg.dataset.timestamp;
    }
  }

  function registrarLog(texto, tipo = 'info') {
    const contenedor = document.getElementById('apiLogList');
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

  function actualizarBanderaSesionUI() {
    const flag = document.getElementById('wpAuthFlag');
    const detail = document.getElementById('wpAuthDetails');
    if (!flag || !detail) return;

    flag.className = 'auth-pill';

    if (!estadoSesionWP.verificado) {
      flag.classList.add('state-pending');
      flag.textContent = 'Sin verificar';
      detail.textContent = 'Ejecuta "Verificar sesion" para comprobar acceso a guardado.';
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
    if (!silencioso) {
      registrarLog('Iniciando verificacion de sesion y permisos...', 'info');
    }

    const nonce = obtenerNonceRest();
    estadoSesionWP.tieneNonce = Boolean(nonce);
    estadoSesionWP.autenticado = false;
    estadoSesionWP.puedeGuardar = false;
    estadoSesionWP.usuarioTexto = 'No autenticado';
    estadoSesionWP.detalle = 'Sin sesion activa';

    try {
      const urlEstado = apiAuthStatusUrl + '?_ts=' + Date.now();
      const headersEstado = nonce ? { 'X-WP-Nonce': nonce } : {};
      const resEstado = await fetch(urlEstado, {
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

      if (!silencioso) {
        registrarLog('No se pudo resolver auth-status. Se usa validacion de respaldo.', 'warning');
      }
    } catch (errorEstado) {
      if (!silencioso) {
        registrarLog('Error consultando auth-status: ' + errorEstado.message, 'warning');
      }
    }

    try {
      const headersUsuario = nonce ? { 'X-WP-Nonce': nonce } : {};
      const resUsuario = await fetch('/wp-json/wp/v2/users/me?context=edit', {
        method: 'GET',
        credentials: 'same-origin',
        headers: headersUsuario
      });

      if (resUsuario.ok) {
        const me = await resUsuario.json();
        estadoSesionWP.autenticado = true;
        estadoSesionWP.usuarioTexto = me && (me.name || me.slug) ? (me.name || me.slug) : 'Usuario autenticado';
      } else if (resUsuario.status === 401 || resUsuario.status === 403) {
        estadoSesionWP.autenticado = false;
        estadoSesionWP.usuarioTexto = 'No autenticado';
      } else {
        estadoSesionWP.usuarioTexto = 'Sesion no confirmada';
      }
    } catch (errorUsuario) {
      estadoSesionWP.usuarioTexto = 'Error consultando usuario';
      if (!silencioso) {
        registrarLog('Error al consultar /users/me: ' + errorUsuario.message, 'error');
      }
    }

    try {
      const headersProbe = { 'Content-Type': 'application/json' };
      if (nonce) {
        headersProbe['X-WP-Nonce'] = nonce;
      }

      // Probar permisos de guardado sin modificar datos: {} provoca 400 si tiene permiso.
      const resProbe = await fetch(apiSyncUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headersProbe,
        body: '{}'
      });

      if (resProbe.status === 400) {
        estadoSesionWP.puedeGuardar = true;
        estadoSesionWP.detalle = 'Permisos de guardado confirmados';
      } else if (resProbe.status === 401 || resProbe.status === 403) {
        estadoSesionWP.puedeGuardar = false;
        estadoSesionWP.detalle = 'Sin permisos para sincronizar';
      } else if (resProbe.ok) {
        estadoSesionWP.puedeGuardar = true;
        estadoSesionWP.detalle = 'Permisos de guardado confirmados';
      } else {
        estadoSesionWP.puedeGuardar = false;
        estadoSesionWP.detalle = 'Respuesta inesperada HTTP ' + resProbe.status;
      }
    } catch (errorProbe) {
      estadoSesionWP.puedeGuardar = false;
      estadoSesionWP.detalle = 'Error verificando permisos';
      if (!silencioso) {
        registrarLog('Error al verificar permisos: ' + errorProbe.message, 'error');
      }
    }

    estadoSesionWP.verificado = true;
    actualizarBanderaSesionUI();

    if (!silencioso) {
      const tipo = (estadoSesionWP.autenticado && estadoSesionWP.puedeGuardar) ? 'success' : 'warning';
      registrarLog('Resultado sesion: ' + estadoSesionWP.usuarioTexto + ' | ' + estadoSesionWP.detalle, tipo);
    }

    return estadoSesionWP;
  }

  // Función principal de arranque seguro
  function verificarYArrancarAdmin() {
    // Comprobamos que los elementos esenciales del HTML ya existan en la página
    const btnCargar = document.getElementById('btnCargarApi');
    const btnGuardar = document.getElementById('btnGuardarApi');
    const btnVerificarSesion = document.getElementById('btnVerificarSesion');
    const btnLimpiarLog = document.getElementById('btnLimpiarLog');
    const formEvt = document.getElementById('formEvento');
    const inputBusq = document.getElementById('inputBuscar');

    // Si WordPress aún no los dibuja, esperamos 200 milisegundos y reintentamos
    if (!btnCargar || !btnGuardar || !inputBusq) {
      setTimeout(verificarYArrancarAdmin, 200);
      return;
    }

    // --- Si llegamos aquí, el HTML ya existe. Activamos la lógica ---
    
    // Vinculamos el ordenamiento a las columnas de la tabla
    if(document.getElementById('thTitulo')) document.getElementById('thTitulo').onclick = function() { ordenarTabla('Titulo'); };
    if(document.getElementById('thFecha')) document.getElementById('thFecha').onclick = function() { ordenarTabla('Fecha_Hora'); };
    if(document.getElementById('thLugar')) document.getElementById('thLugar').onclick = function() { ordenarTabla('Lugar'); };
    if(document.getElementById('thEstado')) document.getElementById('thEstado').onclick = function() { ordenarTabla('Estado'); };
    if(document.getElementById('thTipos')) document.getElementById('thTipos').onclick = function() { ordenarTabla('Tipos'); };

    // Activamos los escuchas de los botones principales
    btnCargar.disabled = false;
    btnGuardar.disabled = false;
    btnCargar.addEventListener('click', cargarDesdeWordPressAPI);
    btnGuardar.addEventListener('click', sincronizarEnWordPressAPI);

    if (btnVerificarSesion) {
      btnVerificarSesion.addEventListener('click', () => verificarSesionWordPressAPI(false));
    }
    if (btnLimpiarLog) {
      btnLimpiarLog.addEventListener('click', () => {
        const contenedor = document.getElementById('apiLogList');
        if (contenedor) contenedor.innerHTML = '';
        registrarLog('Registro limpiado por el usuario.', 'info');
      });
    }

    if (formEvt) {
      formEvt.addEventListener('submit', capturarFormulario);
    }
    inputBusq.addEventListener('input', actualizarTabla);

    const btnCancelar = document.getElementById('btnCancelarEdicion');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', resetearFormulario);
    }

    const btnEnviar = document.getElementById('btnEnviarEvento');
    if (btnEnviar) {
      btnEnviar.addEventListener('click', function(e) {
        e.preventDefault();
        if (formEvt) {
          formEvt.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      });
    }

    const formInputs = document.querySelectorAll('#formEvento input, #formEvento textarea, #formEvento select');
    formInputs.forEach(el => {
      el.addEventListener('input', actualizarPreview);
      el.addEventListener('change', actualizarPreview);
    });

    actualizarPreview();
    actualizarBanderaSesionUI();
    registrarLog('Panel cargado. Verificando sesion automaticamente...', 'info');
    verificarSesionWordPressAPI(true).then(() => {
      const tipo = (estadoSesionWP.autenticado && estadoSesionWP.puedeGuardar) ? 'success' : 'warning';
      registrarLog('Verificacion inicial: ' + estadoSesionWP.usuarioTexto + ' | ' + estadoSesionWP.detalle, tipo);
    });
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

  function normalizarFechaLocal(valor) {
    if (!valor) return '';
    return valor.slice(0, 16);
  }

  function actualizarPreview() {
    const panel = document.getElementById('previewPanel');
    const thumb = document.getElementById('previewThumb');
    const title = document.getElementById('previewTitle');
    const meta = document.getElementById('previewMeta');
    const desc = document.getElementById('previewDesc');

    if (!panel || !thumb || !title || !meta || !desc) return;

    const titulo = document.getElementById('fTitulo').value.trim() || 'Título del evento';
    const fecha = document.getElementById('fFecha').value;
    const lugar = document.getElementById('fLugar').value.trim() || 'Lugar no especificado';
    const estado = document.getElementById('fEstado').value || 'YUC';
    const descripcion = document.getElementById('fDescripcion').value.trim() || 'Sin descripción adicional.';
    const imagen = document.getElementById('fImagen').value.trim();

    const fechaTexto = fecha ? fecha.replace('T', ' · ') : 'Fecha por definir';

    title.textContent = titulo;
    meta.textContent = `${fechaTexto} · ${lugar} · ${estado}`;
    desc.textContent = descripcion;

    if (imagen) {
      thumb.style.backgroundImage = `url('${imagen}')`;
      thumb.style.display = 'block';
    } else {
      thumb.style.display = 'none';
    }

    panel.style.display = 'block';
  }

  function resetearFormulario() {
    const formEvt = document.getElementById('formEvento');
    const btnEnviar = document.getElementById('btnEnviarEvento');
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    const tituloFormulario = document.getElementById('tituloFormulario');

    if (formEvt) formEvt.reset();
    indiceEditando = -1;
    if (btnEnviar) btnEnviar.textContent = 'Añadir a la Lista';
    if (btnCancelar) btnCancelar.style.display = 'none';
    if (tituloFormulario) tituloFormulario.textContent = 'Agregar Nuevo Evento';
    document.getElementById('fEstado').value = 'YUC';
    actualizarPreview();
    mostrarMensaje('Listo para agregar un nuevo evento.', 'info');
  }

  function llenarFormularioDesdeEvento(evento) {
    document.getElementById('fTitulo').value = evento.Titulo || '';
    document.getElementById('fFecha').value = normalizarFechaLocal(evento.Fecha_Hora || '');
    document.getElementById('fEstado').value = evento.Estado || 'Programado';
    document.getElementById('fLugar').value = evento.Lugar || '';
    document.getElementById('fTipos').value = evento.Tipos || '';
    document.getElementById('fDistancias').value = evento.Distancias || '';
    document.getElementById('fLink').value = evento.Link || '';
    document.getElementById('fImagen').value = evento.Imagen || '';
    document.getElementById('fDescripcion').value = evento.Descripcion || '';
    actualizarPreview();
  }

  function editarEvento(index) {
    if (!eventos[index]) return;
    indiceEditando = index;
    llenarFormularioDesdeEvento(eventos[index]);

    const btnEnviar = document.getElementById('btnEnviarEvento');
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    const tituloFormulario = document.getElementById('tituloFormulario');

    if (btnEnviar) btnEnviar.textContent = 'Guardar cambios';
    if (btnCancelar) btnCancelar.style.display = 'inline-block';
    if (tituloFormulario) tituloFormulario.textContent = 'Editar Evento';
    mostrarMensaje('Editando evento: ' + (eventos[index].Titulo || 'sin título'), 'warning');
    document.getElementById('fTitulo').focus();
  }

  function eliminarEvento(index) {
    if (!eventos[index]) return;
    if (!confirm('¿Deseas eliminar este evento de la lista local?')) return;

    const nombre = eventos[index].Titulo || 'este evento';
    eventos.splice(index, 1);
    if (indiceEditando === index) {
      resetearFormulario();
    }
    actualizarTabla();
    mostrarMensaje('Se eliminó: ' + nombre, 'success');
  }

  // ACCION: Cargar datos desde WordPress API
  function cargarDesdeWordPressAPI() {
    registrarLog('Solicitando eventos desde WordPress API...', 'info');
    fetch(apiEventosUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    })
    .then(res => {
      if(!res.ok) throw new Error('No se pudo leer la API de WordPress. Verifica la ruta REST y que el sitio esté disponible.');
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error('La API devolvió un formato inválido. Se esperaba un arreglo de eventos.');
      }

      eventos = data;
      actualizarTabla();
      resetearFormulario();
      mostrarMensaje('Eventos cargados correctamente desde WordPress.', 'success');
      registrarLog('Carga completada. Eventos recibidos: ' + eventos.length, 'success');
    })
    .catch(err => {
      mostrarMensaje(err.message, 'error');
      registrarLog('Error al cargar eventos: ' + err.message, 'error');
    });
  }

  // ACCION: Sincronizar datos en WordPress API
  async function sincronizarEnWordPressAPI() {
    if(eventos.length === 0) return alert('No hay eventos en la lista para subir.');

    const estado = await verificarSesionWordPressAPI(true);
    if (!estado.autenticado || !estado.puedeGuardar) {
      mostrarMensaje('No autorizado para guardar. Verifica sesion y permisos antes de sincronizar.', 'error');
      registrarLog('Bloqueado guardado por sesion/permisos: ' + estado.detalle, 'warning');
      actualizarBanderaSesionUI();
      return;
    }

    const nonce = obtenerNonceRest();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }

    registrarLog('Enviando sincronizacion a WordPress API con ' + eventos.length + ' eventos...', 'info');

    fetch(apiSyncUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        ...headers
      },
      body: JSON.stringify(eventos)
    })
    .then(res => {
      if(!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('No autorizado para guardar. Inicia sesion en WordPress con un usuario editor/admin y verifica el nonce REST.');
        }
        throw new Error('Error al guardar en WordPress. Codigo HTTP: ' + res.status);
      }
      return res.json();
    })
    .then(data => {
      if (!data || data.ok !== true) {
        throw new Error('La API respondio sin confirmar la sincronizacion.');
      }
      mostrarMensaje('WordPress sincronizado correctamente. El calendario ya quedó actualizado.', 'success');
      registrarLog('Sincronizacion completada correctamente. Insertados: ' + (data.insertados ?? 'n/d'), 'success');
    })
    .catch(err => {
      mostrarMensaje(err.message, 'error');
      registrarLog('Error al sincronizar: ' + err.message, 'error');
    });
  }

  // ACCIÓN: Captura del Formulario
  function capturarFormulario(e) {
    e.preventDefault();

    const tituloInput = document.getElementById('fTitulo');
    const fechaInput = document.getElementById('fFecha');

    if (!tituloInput || !fechaInput) return;

    if (!tituloInput.value.trim()) {
      tituloInput.focus();
      mostrarMensaje('El título del evento es obligatorio.', 'error');
      return;
    }

    if (!fechaInput.value) {
      fechaInput.focus();
      mostrarMensaje('La fecha y hora del evento son obligatorias.', 'error');
      return;
    }
    
    const nuevoEvento = {
      Titulo: tituloInput.value.trim(),
      Fecha_Hora: normalizarFechaLocal(fechaInput.value),
      Lugar: document.getElementById('fLugar').value.trim() || 'No especificado',
      Estado: document.getElementById('fEstado').value,
      Tipos: document.getElementById('fTipos').value.trim() || '',
      Distancias: document.getElementById('fDistancias').value.trim() || 'N/A',
      Link: document.getElementById('fLink').value.trim() || '',
      Imagen: document.getElementById('fImagen').value.trim() || '',
      Descripcion: document.getElementById('fDescripcion').value.trim() || ''
    };

    if (!nuevoEvento.Fecha_Hora) {
      fechaInput.focus();
      mostrarMensaje('La fecha y hora del evento son obligatorias.', 'error');
      return;
    }

    if (indiceEditando >= 0) {
      eventos[indiceEditando] = nuevoEvento;
      mostrarMensaje('Evento actualizado correctamente.', 'success');
    } else {
      eventos.push(nuevoEvento);
      mostrarMensaje('Evento añadido a la lista local.', 'success');
    }

    actualizarTabla();
    resetearFormulario();
  }

  // Renderizado de la tabla
  function actualizarTabla() {
    const cuerpo = document.getElementById('cuerpoTabla');
    const elBuscar = document.getElementById('inputBuscar');
    const contador = document.getElementById('contadorEventos');
    if(!cuerpo || !elBuscar || !contador) return;

    const filtro = elBuscar.value.toLowerCase();
    cuerpo.innerHTML = '';

    const filtrados = eventos.filter(ev => {
      return (ev.Titulo || '').toLowerCase().includes(filtro) || 
             (ev.Lugar || '').toLowerCase().includes(filtro) || 
             (ev.Estado || '').toLowerCase().includes(filtro) ||
             (ev.Tipos || '').toLowerCase().includes(filtro);
    });

    contador.textContent = eventos.length + (eventos.length === 1 ? ' evento' : ' eventos');

    if(filtrados.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">Lista vacía o ningún filtro coincide.</td></tr>';
      return;
    }

    filtrados.forEach(ev => {
      const fila = document.createElement('tr');
      const fFormated = (ev.Fecha_Hora || '').replace('T', ' ');
      const index = eventos.indexOf(ev);
      
      let badgeClass = 'bg-adm-programado';
      if((ev.Estado || '').toLowerCase() === 'cancelado') badgeClass = 'bg-adm-cancelado';
      if(['completo','cerrado'].includes((ev.Estado || '').toLowerCase())) badgeClass = 'bg-adm-modificado';

      if (index === indiceEditando) {
        fila.classList.add('is-editing');
      }

      fila.innerHTML = `
        <td><strong>${ev.Titulo}</strong></td>
        <td style="white-space:nowrap;">${fFormated}</td>
        <td>${ev.Lugar}</td>
        <td><span class="badge-adm ${badgeClass}">${ev.Estado}</span></td>
        <td><small>${ev.Tipos}</small></td>
        <td>
          <button type="button" class="btn-table btn-table-edit" data-edit>Editar</button>
          <button type="button" class="btn-table btn-table-delete" data-delete>Eliminar</button>
        </td>
      `;

      const btnEdit = fila.querySelector('[data-edit]');
      const btnDel = fila.querySelector('[data-delete]');

      btnEdit.addEventListener('click', () => editarEvento(index));
      btnDel.addEventListener('click', () => eliminarEvento(index));

      cuerpo.appendChild(fila);
    });
  }

  // Lógica de ordenamiento
  function ordenarTabla(columna) {
    if (colActual === columna) { ordenAsc = !ordenAsc; } else { colActual = columna; ordenAsc = true; }
    
    const headers = document.querySelectorAll('.container-admin th');
    headers.forEach(th => th.className = '');
    
    const idx = ['Titulo', 'Fecha_Hora', 'Lugar', 'Estado', 'Tipos'].indexOf(columna);
    if(idx !== -1 && headers[idx]) headers[idx].className = ordenAsc ? 'asc' : 'desc';

    eventos.sort((a, b) => {
      let valA = (a[columna] || '').toLowerCase(); 
      let valB = (b[columna] || '').toLowerCase();
      if (valA < valB) return ordenAsc ? -1 : 1;
      if (valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });
    actualizarTabla();
  }

  // Lanzamiento controlado según el estado del DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarYArrancarAdmin);
  } else {
    verificarYArrancarAdmin();
  }
})();