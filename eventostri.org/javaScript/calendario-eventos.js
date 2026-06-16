(function(){
  // URL de tu Google Apps Script
  var apiUrl = 'https://script.google.com/macros/s/AKfycby1YD02A6MwSx-6UQYj1ymiQt2an7_Zojis0JbO2KBjLdeZS3JRwlU-xsGzy5I1czzN/exec';
  var todosLosEventos = [];
  var calendar;

  function verificarYArrancar() {
    if (typeof FullCalendar !== 'undefined') {
      cargarDatosYRenderizar();
    } else {
      setTimeout(verificarYArrancar, 200);
    }
  }

  function cargarDatosYRenderizar() {
    var el = document.getElementById('calendario-eventos');
    if (!el) return;

    // Agregamos opciones de redirección para evitar que el canal de comunicación se cierre antes de tiempo
    fetch(apiUrl, { method: 'GET', redirect: 'follow' })
      .then(function(res) { 
        if (!res.ok) {
          throw new Error('Respuesta de red no okey. Estatus: ' + res.status);
        }
        return res.json(); 
      })
      .then(function(data) {
        // Si el script devolvió un objeto de error en vez de un arreglo
        if (!Array.isArray(data)) {
          throw new Error('Los datos devueltos por Google Sheets no son una lista válida.');
        }

        todosLosEventos = data.map(function(item) {
          return {
            title: item.Titulo || 'Evento sin título',
            start: item.Fecha_Hora,
            extendedProps: {
              lugar: item.Lugar || 'No especificado',
              estado: item.Estado || 'Programado',
              tiposArray: item.Tipos ? item.Tipos.split(',').map(function(s){return s.trim();}) : [],
              distanciasArray: item.Distancias ? item.Distancias.split(',').map(function(s){return s.trim();}) : [],
              tiposOriginal: item.Tipos || '',
              distanciasOriginal: item.Distancias || 'N/A',
              link: item.Link || '',
              imagen: item.Imagen || '',
              descripcion: item.Descripcion || ''
            }
          };
        });

        el.innerHTML = ''; 
        el.style.background = 'transparent';
        el.style.border = 'none';

        calendar = new FullCalendar.Calendar(el, {
          initialView: 'dayGridMonth',
          locale: 'es',
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
          events: todosLosEventos,
          eventClick: function(info) {
            var p = info.event.extendedProps;
            document.getElementById('evtTitulo').innerText = info.event.title;
            document.getElementById('evtLugar').innerText = p.lugar;
            document.getElementById('evtDistancias').innerText = p.distanciasOriginal;
            document.getElementById('evtTipos').innerText = p.tiposOriginal;
            document.getElementById('evtDescripcion').innerText = p.descripcion;
            
            var st = document.getElementById('evtEstado');
            st.innerText = p.estado;
            if(p.estado.toLowerCase() === 'cancelado') { st.style.backgroundColor = '#d9534f'; }
            else if(['completo','cerrado','yuc'].includes(p.estado.toLowerCase())) { st.style.backgroundColor = '#f0ad4e'; }
            else { st.style.backgroundColor = '#5cb85c'; }

            var img = document.getElementById('evtImagen');
            if(p.imagen && p.imagen.startsWith('http')) { img.src = p.imagen; img.style.display = 'block'; }
            else { img.style.display = 'none'; }

            var lk = document.getElementById('evtLink');
            if(p.link && p.link.startsWith('http')) { lk.href = p.link; lk.style.display = 'block'; }
            else { lk.style.display = 'none'; }

            var m = document.getElementById('miModal');
            var c = document.getElementById('modalContenido');
            m.style.setProperty('display', 'flex', 'important');
            setTimeout(function() { m.style.opacity = '1'; c.style.transform = 'scale(1)'; }, 50);
          }
        });
        
        calendar.render();
        document.getElementById('filtroTipo').addEventListener('change', aplicarFiltros);
        document.getElementById('filtroDistancia').addEventListener('change', aplicarFiltros);
      })
      .catch(function(err) {
        console.error("Detalle del error de conexión:", err);
        // Desplegamos el error exacto de la respuesta en la caja para saber qué le duele a la API
        el.innerHTML = '<div style="color:#c9302c; text-align:center; padding: 20px; background:#fdf7f7; border:1px solid #eed3d7; border-radius:4px;">' +
                       '<strong>Error de comunicación con Google Sheets:</strong><br>' + err.message + 
                       '<br><br><small>Revisa si la macro está publicada para "Cualquiera" o si hay un bloqueo en el navegador.</small></div>';
      });
  }

  function aplicarFiltros() {
    if (!calendar) return;
    var t = document.getElementById('filtroTipo').value;
    var d = document.getElementById('filtroDistancia').value;
    var f = todosLosEventos.filter(function(ev) {
      var cT = t === "" || ev.extendedProps.tiposArray.includes(t);
      var cD = d === "" || ev.extendedProps.distanciasArray.includes(d);
      return cT && cD;
    });
    calendar.removeAllEvents();
    calendar.addEventSource(f);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarYArrancar);
  } else {
    verificarYArrancar();
  }
})();

function cerrarModal() {
  var m = document.getElementById('miModal');
  var c = document.getElementById('modalContenido');
  m.style.opacity = '0'; c.style.transform = 'scale(0.9)';
  setTimeout(function() { m.style.setProperty('display', 'none', 'important'); }, 300);
}
window.onclick = function(e) { if (e.target == document.getElementById('miModal')) cerrarModal(); };