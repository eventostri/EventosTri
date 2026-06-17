(function(){
  let eventos = [];
  let colActual = '';
  let ordenAsc = true;
  let indiceEditando = -1;
  const nombreArchivo = 'eventos.json';

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

  // Función principal de arranque seguro
  function verificarYArrancarAdmin() {
    // Comprobamos que los elementos esenciales del HTML ya existan en la página
    const btnCargar = document.getElementById('btnCargarGist');
    const btnGuardar = document.getElementById('btnGuardarGist');
    const formEvt = document.getElementById('formEvento');
    const inputBusq = document.getElementById('inputBuscar');

    // Si WordPress aún no los dibuja, esperamos 200 milisegundos y reintentamos
    if (!btnCargar || !btnGuardar || !inputBusq) {
      setTimeout(verificarYArrancarAdmin, 200);
      return;
    }

    // --- Si llegamos aquí, el HTML ya existe. Activamos la lógica ---
    
    // Recupera credenciales previas del navegador
    if(localStorage.getItem('git_token')) document.getElementById('cToken').value = localStorage.getItem('git_token');
    if(localStorage.getItem('git_gistid')) document.getElementById('cGistId').value = localStorage.getItem('git_gistid');
    
    // Vinculamos el ordenamiento a las columnas de la tabla
    if(document.getElementById('thTitulo')) document.getElementById('thTitulo').onclick = function() { ordenarTabla('Titulo'); };
    if(document.getElementById('thFecha')) document.getElementById('thFecha').onclick = function() { ordenarTabla('Fecha_Hora'); };
    if(document.getElementById('thLugar')) document.getElementById('thLugar').onclick = function() { ordenarTabla('Lugar'); };
    if(document.getElementById('thEstado')) document.getElementById('thEstado').onclick = function() { ordenarTabla('Estado'); };
    if(document.getElementById('thTipos')) document.getElementById('thTipos').onclick = function() { ordenarTabla('Tipos'); };

    // Activamos los escuchas de los botones principales
    btnCargar.disabled = false;
    btnGuardar.disabled = false;
    btnCargar.addEventListener('click', descagarDeNube);
    btnGuardar.addEventListener('click', guardarEnNube);

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
  }

  function guardarCredenciales() {
    try {
      localStorage.setItem('git_token', document.getElementById('cToken').value);
      localStorage.setItem('git_gistid', document.getElementById('cGistId').value);
    } catch (e) {
      // El navegador puede bloquear el almacenamiento en algunos contextos.
    }
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

  // ACCIÓN: Descargar datos
  function descagarDeNube() {
    const token = document.getElementById('cToken').value;
    const gistId = document.getElementById('cGistId').value;
    
    if(!token || !gistId) return alert('Por favor rellena el Token y el ID del Gist.');
    guardarCredenciales();

    fetch('https://api.github.com/gists/' + encodeURIComponent(gistId), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json'
      }
    })
    .then(res => {
      if(!res.ok) throw new Error('No se pudo acceder al Gist. Verifica las llaves y sus permisos.');
      return res.json();
    })
    .then(gist => {
      if(gist.files && gist.files[nombreArchivo]) {
        try {
          eventos = JSON.parse(gist.files[nombreArchivo].content);
        } catch (e) {
          throw new Error('El archivo del Gist no tiene un JSON válido.');
        }
        actualizarTabla();
        resetearFormulario();
        mostrarMensaje('Eventos cargados correctamente desde la nube.', 'success');
      } else {
        mostrarMensaje('No se encontró el archivo en el Gist. Se iniciará una lista limpia.', 'warning');
        eventos = [];
        actualizarTabla();
        resetearFormulario();
      }
    })
    .catch(err => {
      mostrarMensaje(err.message, 'error');
    });
  }

  // ACCIÓN: Guardar datos
  function guardarEnNube() {
    const token = document.getElementById('cToken').value;
    const gistId = document.getElementById('cGistId').value;
    
    if(!token || !gistId) return alert('Por favor rellena el Token y el ID del Gist.');
    if(eventos.length === 0) return alert('No hay eventos en la lista para subir.');
    
    guardarCredenciales();

    const datosCuerpo = {
      description: "Actualización automática del calendario de eventos",
      files: {
        [nombreArchivo]: {
          filename: nombreArchivo,
          content: JSON.stringify(eventos, null, 2)
        }
      }
    };

    fetch('https://api.github.com/gists/' + encodeURIComponent(gistId), {
      method: 'PATCH',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datosCuerpo)
    })
    .then(res => {
      if(!res.ok) throw new Error('Error al actualizar en la nube. Asegúrate de que tu Token tenga permisos de escritura (Write access).');
      return res.json();
    })
    .then(data => {
      const contenidoEsperado = JSON.stringify(eventos, null, 2);
      const contenidoReal = data && data.files && data.files[nombreArchivo] && data.files[nombreArchivo].content;
      if (contenidoReal !== contenidoEsperado) {
        throw new Error('La API respondió, pero el contenido del Gist no coincide con la lista actual.');
      }
      mostrarMensaje('Gist actualizado correctamente. El calendario ya quedó sincronizado.', 'success');
    })
    .catch(err => {
      mostrarMensaje(err.message, 'error');
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