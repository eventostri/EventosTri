(function() {
    if (window.__eventosCalendarioInicializado) {
        return;
    }
    window.__eventosCalendarioInicializado = true;

    let datosEventos = [];
    let calendarioInstancia = null;
    const urlJSON = 'https://gist.githubusercontent.com/alverpadilla/c49faeebe433ca13a6ddd54548e44980/raw/eventos.json';

    // 1. Inyección de estilos CSS internos

    // 2. Carga dinámica de FullCalendar
    const cssFullCalendar = document.createElement('link');
    cssFullCalendar.rel = 'stylesheet';
    cssFullCalendar.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css';
    document.head.appendChild(cssFullCalendar);

    const scriptFullCalendar = document.createElement('script');
    scriptFullCalendar.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js';
    document.head.appendChild(scriptFullCalendar);

    scriptFullCalendar.onload = () => {
        fetch(urlJSON, { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("Gist no responde");
                return response.json();
            })
            .then(data => {
                datosEventos = data;
                ejecutarInicializacion();
            })
            .catch(err => console.error("Error cargando origen de datos:", err));
    };

    function obtenerPropiedad(objeto, nombreClave) {
        if (!objeto) return "";
        const claveEncontrada = Object.keys(objeto).find(k => k.toLowerCase() === nombreClave.toLowerCase());
        return claveEncontrada ? objeto[claveEncontrada] : "";
    }

    function detectarFecha(evento) {
        const posiblesClaves = ['fecha_hora', 'fechaexp', 'fecha', 'date'];
        for (let clave of posiblesClaves) {
            const valor = obtenerPropiedad(evento, clave);
            if (valor) return valor;
        }
        return null;
    }

    function detectarTitulo(evento) {
        const posiblesClaves = ['title', 'titulo', 'nombre', 'name', 'evento', 'descripcion'];
        for (let clave of posiblesClaves) {
            const valor = obtenerPropiedad(evento, clave);
            if (valor && String(valor).trim() !== "") return String(valor).trim();
        }
        return "Evento deportivo";
    }

    function escapeHtml(texto) {
        return String(texto || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
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

        const diaSemanaFmt = diaSemana.replace(/(^|\s)([a-záéíóúñ])/gi, (match, espacio, letra) => espacio + letra.toUpperCase());
        const diaFmt = dia.replace(/^0/, '');
        const mesFmt = mes.replace(/(^|\s)([a-záéíóúñ])/gi, (match, espacio, letra) => espacio + letra.toUpperCase());
        const horaFmt = hora.replace(/\s/g, '').replace(/\./g, '').replace(/(?<=\d)(AM|PM)/i, ' $1');

        return `${diaSemanaFmt}, ${diaFmt} de ${mesFmt} de ${anio} · ${horaFmt}`;
    }

    function crearModalEvento() {
        if (document.getElementById('modal-evento-calendario')) {
            return document.getElementById('modal-evento-calendario');
        }

        const overlay = document.createElement('div');
        overlay.id = 'modal-evento-calendario';
        overlay.className = 'evento-modal-overlay';

        overlay.innerHTML = `
            <div class="evento-modal-card">
                <button class="evento-modal-close" aria-label="Cerrar detalle">×</button>
                <div class="evento-modal-image-wrap">
                    <img class="evento-modal-image" alt="Imagen del evento">
                </div>
                <div class="evento-modal-content">
                    <h3 class="evento-modal-title"></h3>
                    <div class="evento-modal-meta">
                        <span class="evento-modal-label">Lugar</span>
                        <p class="evento-modal-place"></p>
                    </div>
                    <div class="evento-modal-meta">
                        <span class="evento-modal-label">Fecha y hora</span>
                        <p class="evento-modal-date"></p>
                    </div>
                    <div class="evento-modal-meta">
                        <span class="evento-modal-label">Distancias</span>
                        <div class="evento-modal-distances"></div>
                    </div>
                    <div class="evento-modal-meta evento-modal-link-block">
                        <span class="evento-modal-label">Enlace</span>
                        <div class="evento-modal-link-wrap"></div>
                    </div>
                    <div class="evento-modal-meta evento-modal-description-block">
                        <span class="evento-modal-label">Descripción</span>
                        <p class="evento-modal-description"></p>
                    </div>
                </div>
            </div>
        `;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('is-open');
            }
        });

        overlay.querySelector('.evento-modal-close').addEventListener('click', () => {
            overlay.classList.remove('is-open');
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function mostrarDetalleEvento(evento) {
        const modal = crearModalEvento();
        const imagen = modal.querySelector('.evento-modal-image');
        const titulo = modal.querySelector('.evento-modal-title');
        const lugar = modal.querySelector('.evento-modal-place');
        const fecha = modal.querySelector('.evento-modal-date');
        const distancias = modal.querySelector('.evento-modal-distances');
        const linkWrap = modal.querySelector('.evento-modal-link-wrap');
        const descripcion = modal.querySelector('.evento-modal-description');

        const datos = evento.extendedProps || {};
        const url = (datos.link || '').trim();
        const imagenUrl = (datos.imagen || '').trim();
        const tituloTexto = datos.titulo || evento.title || 'Evento deportivo';
        const lugarTexto = datos.lugar || 'Sin lugar especificado';
        const fechaTexto = datos.fechaFormateada || formatearFecha(evento.start || datos.fecha_hora);
        const distanciasTexto = datos.distancias || '';
        const descripcionTexto = datos.descripcion || '';

        titulo.textContent = tituloTexto;
        lugar.textContent = lugarTexto;
        fecha.textContent = fechaTexto;
        descripcion.textContent = descripcionTexto || 'No hay descripción disponible.';

        if (imagenUrl) {
            imagen.src = imagenUrl;
            imagen.style.display = 'block';
        } else {
            imagen.removeAttribute('src');
            imagen.style.display = 'none';
        }

        distancias.innerHTML = '';
        if (distanciasTexto) {
            const lista = String(distanciasTexto)
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

            lista.forEach((item) => {
                const badge = document.createElement('span');
                badge.className = 'evento-modal-distance-pill';
                badge.textContent = item;
                distancias.appendChild(badge);
            });
        } else {
            distancias.innerHTML = '<span class="evento-modal-distance-pill">Sin distancias</span>';
        }

        linkWrap.innerHTML = '';
        if (url) {
            if (/facebook\.com|fb\.me|fb\.com/i.test(url)) {
                const icon = document.createElement('a');
                icon.className = 'evento-modal-facebook-icon';
                icon.href = url;
                icon.target = '_blank';
                icon.rel = 'noopener noreferrer';
                icon.setAttribute('aria-label', 'Abrir Facebook del evento');
                icon.innerHTML = 'f';
                linkWrap.appendChild(icon);
            } else {
                const enlace = document.createElement('a');
                enlace.className = 'evento-modal-url-link';
                enlace.href = url;
                enlace.target = '_blank';
                enlace.rel = 'noopener noreferrer';
                enlace.textContent = url;
                linkWrap.appendChild(enlace);
            }
        } else {
            linkWrap.innerHTML = '<span class="evento-modal-url-link evento-modal-url-link--disabled">Sin enlace disponible</span>';
        }

        modal.classList.add('is-open');
    }

    // 3. Esperar estructura de WordPress/Elementor
    function ejecutarInicializacion() {
        const txtContenedorTipo = document.getElementById('filtro-tipo-container');
        const txtContenedorLugar = document.getElementById('filtro-lugar-container');
        const txtCalendario = document.getElementById('calendario');

        if (!txtContenedorTipo || !txtContenedorLugar || !txtCalendario) {
            return false;
        }

        if (txtCalendario.dataset.fcInicializado === 'true') {
            return true;
        }

        txtCalendario.dataset.fcInicializado = 'true';

        // Solo creamos el wrapper si no existe ya
        if (!document.querySelector('.wrapper-eventos')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'wrapper-eventos';
            txtCalendario.parentNode.insertBefore(wrapper, txtCalendario);
            wrapper.appendChild(txtCalendario);
            // Mover filtros al wrapper
            const contenedorFiltros = document.querySelector('.filtros-container');
            if (contenedorFiltros) {
                wrapper.appendChild(contenedorFiltros);
            }
        }

        generarCheckboxes(datosEventos, 'tipos', 'filtro-tipo-container');
        generarCheckboxes(datosEventos, 'lugar', 'filtro-lugar-container');
        inicializarGridMensual(datosEventos);
        return true;
    }

    // 4. Generador de Checkboxes con contadores dinámicos y orden descendente por popularidad
    function generarCheckboxes(eventos, propiedad, contenedorId) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        const conteoValores = {};

        // Recolectar valores y calcular frecuencias de aparición
        eventos.forEach(ev => {
            const valorRaw = obtenerPropiedad(ev, propiedad);
            if (!valorRaw || valorRaw === "N/A" || String(valorRaw).trim() === "") return;
            
            // Soportamos separación por comas o diagonales
            String(valorRaw).split(/[,\/]/).forEach(v => {
                const valorLimpio = v.trim();
                if (valorLimpio) {
                    conteoValores[valorLimpio] = (conteoValores[valorLimpio] || 0) + 1;
                }
            });
        });

        // Convertimos las llaves en un array para poder ordenarlo
        const opcionesOrdenadas = Object.keys(conteoValores);

        // LÓGICA DE ORDENAMIENTO:
        // Si estamos modificando el contenedor de "lugar", ordenamos por cantidad de eventos (mayor a menor)
        // Si el conteo es idéntico, rompe el empate de forma alfabética.
        if (propiedad === 'lugar') {
            opcionesOrdenadas.sort((a, b) => {
                const diferencia = conteoValores[b] - conteoValores[a];
                return diferencia !== 0 ? diferencia : a.localeCompare(b);
            });
        } else {
            // Para la propiedad 'tipos', priorizamos Running y MTB antes del resto,
            // y dejamos el resto en orden alfabético.
            opcionesOrdenadas.sort((a, b) => {
                const ordenPreferido = ['Running', 'MTB'];
                const indiceA = ordenPreferido.indexOf(a);
                const indiceB = ordenPreferido.indexOf(b);

                if (indiceA !== -1 && indiceB !== -1) {
                    return indiceA - indiceB;
                }
                if (indiceA !== -1) return -1;
                if (indiceB !== -1) return 1;
                return a.localeCompare(b);
            });
        }

        contenedor.innerHTML = '';
        opcionesOrdenadas.forEach(opcion => {
            const totalEventos = conteoValores[opcion];
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            
            // Estructura limpia: el checkbox y texto a la izquierda, y el badge contador alineado a la derecha
            label.innerHTML = `
                <div>
                    <input type="checkbox" value="${opcion}" style="margin-right:8px;"> 
                    <span>${opcion}</span>
                </div>
            `;
            
            label.querySelector('input').addEventListener('change', () => {
                const tiposCheck = Array.from(document.querySelectorAll('#filtro-tipo-container input:checked')).map(i => i.value);
                const lugaresCheck = Array.from(document.querySelectorAll('#filtro-lugar-container input:checked')).map(i => i.value);

                const filtrados = datosEventos.filter(evento => {
                    const eTipo = obtenerPropiedad(evento, 'tipos');
                    const eLugar = obtenerPropiedad(evento, 'lugar');
                    const cTipo = tiposCheck.length === 0 || tiposCheck.some(t => eTipo && String(eTipo).includes(t));
                    const cLugar = lugaresCheck.length === 0 || lugaresCheck.includes(eLugar);
                    return cTipo && cLugar;
                });

                actualizarCalendarioDinamico(filtrados);
            });
            contenedor.appendChild(label);
        });
    }

    function calcularDiasAOcultar(eventosFiltrados) {
        const diasSemanaOcultables = [1, 2, 3, 4, 5];
        const diasConEventos = new Set();

        eventosFiltrados.forEach(evento => {
            const eFecha = detectarFecha(evento);
            if (eFecha) {
                const fechaPlana = String(eFecha).split(/[T ]/)[0];
                const partes = fechaPlana.split('-');
                if (partes.length === 3) {
                    const fObj = new Date(partes[0], partes[1] - 1, partes[2]);
                    if (!isNaN(fObj.getTime())) {
                        diasConEventos.add(fObj.getDay());
                    }
                }
            }
        });

        return diasSemanaOcultables.filter(dia => !diasConEventos.has(dia));
    }

    // 5. Montar el calendario inicial
    function inicializarGridMensual(eventos) {
        const contenedorEl = document.getElementById('calendario');
        const eventosMapeados = mapearEventos(eventos);
        const diasAOcultarInicial = calcularDiasAOcultar(eventos);

        if (calendarioInstancia) {
            calendarioInstancia.destroy();
            calendarioInstancia = null;
        }

        calendarioInstancia = new FullCalendar.Calendar(contenedorEl, {
            initialView: 'dayGridMonth',
            handleWindowResize: true,
            locale: 'es',
            titleFormat: { year: 'numeric', month: 'short' },
            hiddenDays: diasAOcultarInicial,
            buttonText: {
                today: 'Hoy',
                dayGridMonth: 'Mes',
                timeGridWeek: 'Semana',
                listMonth: 'Lista'
            },            
            headerToolbar: {
                start: 'prev,next',
				end: 'title'
            },
            footerToolbar: {
                start: 'today',
                end: 'dayGridMonth,timeGridWeek,listMonth'
            },
            eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false },
            events: eventosMapeados,
            eventClick: function(info) {
                info.jsEvent.preventDefault();
                mostrarDetalleEvento(info.event);
            }
        });

        calendarioInstancia.render();
    }

    function mapearEventos(eventos) {
        return eventos.map(evento => {
            const eTitle = detectarTitulo(evento);
            const eFechaRaw = detectarFecha(evento);
            const eLink = obtenerPropiedad(evento, 'link');
            const eLugar = obtenerPropiedad(evento, 'lugar');
            const eDistancias = obtenerPropiedad(evento, 'distancias');
            const eImagen = obtenerPropiedad(evento, 'imagen');
            const eDescripcion = obtenerPropiedad(evento, 'descripcion');

            return {
                title: eTitle,
                start: eFechaRaw ? String(eFechaRaw).trim() : null,
                url: eLink,
                allDay: false,
                extendedProps: {
                    titulo: eTitle,
                    lugar: eLugar,
                    distancias: eDistancias,
                    imagen: eImagen,
                    descripcion: eDescripcion,
                    link: eLink,
                    fecha_hora: eFechaRaw,
                    fechaFormateada: formatearFecha(eFechaRaw)
                }
            };
        }).filter(e => e.start !== null);
    }

    function actualizarCalendarioDinamico(eventosFiltrados) {
        if (!calendarioInstancia) return;

        const nuevosDiasAOcultar = calcularDiasAOcultar(eventosFiltrados);
        calendarioInstancia.setOption('hiddenDays', nuevosDiasAOcultar);
        
        calendarioInstancia.removeAllEvents();
        calendarioInstancia.addEventSource(mapearEventos(eventosFiltrados));
    }
})();