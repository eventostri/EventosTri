(function() {
    if (window.__eventostriCalendarioPublicoInicializado) {
        return;
    }
    window.__eventostriCalendarioPublicoInicializado = true;

    let datosEventos = [];
    let calendarioInstancia = null;
    let rangoVisibleMes = null;
    let terminoBusqueda = '';
    let terminoBusquedaModal = '';
    let indiceActivoBusquedaModal = -1;
    let resultadosBusquedaModal = [];
    let ultimoTerminoAnaliticaModal = '';
    let ultimoElementoConFoco = null;
    const CLAVE_ANALITICA_BUSQUEDA = '__eventostriSearchAnalytics';
    const urlJSON = (window.eventostriCalendarioConfig && window.eventostriCalendarioConfig.eventosUrl)
        ? window.eventostriCalendarioConfig.eventosUrl
        : '/wp-json/eventostri/v1/eventos';

    if (!window.FullCalendar) {
        return;
    }

    fetch(urlJSON, { cache: 'no-store' })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('La API de WordPress no responde');
            }
            return response.json();
        })
        .then(function(data) {
            datosEventos = Array.isArray(data) ? data : [];
            ejecutarInicializacion();
        })
        .catch(function(err) {
            console.error('Error cargando origen de datos:', err);
        });

    function obtenerPropiedad(objeto, nombreClave) {
        if (!objeto) return '';
        const claveEncontrada = Object.keys(objeto).find(function(k) {
            return k.toLowerCase() === nombreClave.toLowerCase();
        });
        return claveEncontrada ? objeto[claveEncontrada] : '';
    }

    function obtenerTiposArray(evento) {
        const valor = obtenerPropiedad(evento, 'tipos');
        return String(valor || '')
            .split(',')
            .map(function(tipo) { return tipo.trim(); })
            .filter(Boolean);
    }

    function ordenarOpcionesTipo(opciones) {
        return opciones.sort(function(a, b) {
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

    function ordenarOpcionesLugar(opciones, conteoValores) {
        const topTres = opciones
            .slice()
            .sort(function(a, b) {
                const diferencia = conteoValores[b] - conteoValores[a];
                return diferencia !== 0 ? diferencia : a.localeCompare(b);
            })
            .slice(0, 3);

        const resto = opciones
            .filter(function(opcion) { return !topTres.includes(opcion); })
            .sort(function(a, b) { return a.localeCompare(b); });

        return topTres.concat(resto);
    }

    function obtenerColorPorTipos(tipos) {
        const texto = tipos.map(function(tipo) {
            return tipo.toLowerCase();
        });

        if (texto.some(function(tipo) { return tipo.includes('mtb'); })) {
            return {
                backgroundColor: '#ffe2d7',
                borderColor: '#f5a283',
                textColor: '#9a3f1f'
            };
        }

        if (texto.some(function(tipo) { return tipo.includes('running'); })) {
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

    function detectarFecha(evento) {
        const posiblesClaves = ['fecha_hora', 'fechaexp', 'fecha', 'date'];
        for (let index = 0; index < posiblesClaves.length; index++) {
            const valor = obtenerPropiedad(evento, posiblesClaves[index]);
            if (valor) {
                return valor;
            }
        }
        return null;
    }

    function detectarTitulo(evento) {
        const posiblesClaves = ['title', 'titulo', 'nombre', 'name', 'evento', 'descripcion'];
        for (let index = 0; index < posiblesClaves.length; index++) {
            const valor = obtenerPropiedad(evento, posiblesClaves[index]);
            if (valor && String(valor).trim() !== '') {
                return String(valor).trim();
            }
        }
        return 'Evento deportivo';
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

        const diaSemanaFmt = diaSemana.replace(/(^|\s)([a-záéíóúñ])/gi, function(match, espacio, letra) {
            return espacio + letra.toUpperCase();
        });
        const diaFmt = dia.replace(/^0/, '');
        const mesFmt = mes.replace(/(^|\s)([a-záéíóúñ])/gi, function(match, espacio, letra) {
            return espacio + letra.toUpperCase();
        });
        const horaFmt = hora.replace(/\s/g, '').replace(/\./g, '').replace(/(?<=\d)(AM|PM)/i, ' $1');

        return diaSemanaFmt + ', ' + diaFmt + ' de ' + mesFmt + ' de ' + anio + ' · ' + horaFmt;
    }

    function normalizarTextoBusqueda(valor) {
        const base = String(valor || '').toLowerCase().trim();
        if (typeof base.normalize === 'function') {
            return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return base;
    }

    function escaparParaSelector(valor) {
        return String(valor || '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
    }

    function construirClaveEventoDesdeDatos(titulo, fecha, lugar) {
        const fechaTexto = String(fecha || '').split(/[T ]/)[0];
        return normalizarTextoBusqueda(titulo) + '|' + fechaTexto + '|' + normalizarTextoBusqueda(lugar);
    }

    function construirClaveEvento(evento) {
        return construirClaveEventoDesdeDatos(
            detectarTitulo(evento),
            detectarFecha(evento),
            obtenerPropiedad(evento, 'lugar')
        );
    }

    function registrarAnaliticaBusqueda(tipo, payload) {
        const evento = Object.assign({
            tipo: tipo,
            timestamp: new Date().toISOString()
        }, payload || {});

        if (!Array.isArray(window[CLAVE_ANALITICA_BUSQUEDA])) {
            window[CLAVE_ANALITICA_BUSQUEDA] = [];
        }
        window[CLAVE_ANALITICA_BUSQUEDA].push(evento);

        if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push(Object.assign({
                event: 'eventostri_search_' + tipo
            }, payload || {}));
        }

        if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('eventostri:search-analytics', { detail: evento }));
        }
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

    function esVisibleEnCalendario(evento) {
        return normalizarBoolean(obtenerPropiedad(evento, 'VisibleEnCalendario'), true);
    }

    function esEventoVigentePublico(evento) {
        const fechaEvento = detectarFecha(evento);
        if (!fechaEvento) return false;
        const soloFecha = String(fechaEvento).split(/[T ]/)[0];
        const partes = soloFecha.split('-');
        if (partes.length !== 3) return false;
        const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
        if (Number.isNaN(fecha.getTime())) return false;
        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        return fecha >= inicioHoy;
    }

    function obtenerEventosPublicosBase() {
        return datosEventos.filter(function(evento) {
            return esVisibleEnCalendario(evento) && esEventoVigentePublico(evento);
        });
    }

    function crearModalEvento() {
        if (document.getElementById('modal-evento-calendario')) {
            return document.getElementById('modal-evento-calendario');
        }

        const overlay = document.createElement('div');
        overlay.id = 'modal-evento-calendario';
        overlay.className = 'evento-modal-overlay';

        overlay.innerHTML = [
            '<div class="evento-modal-card">',
            '<button class="evento-modal-close" aria-label="Cerrar detalle">×</button>',
            '<div class="evento-modal-image-wrap">',
            '<img class="evento-modal-image" alt="Imagen del evento">',
            '</div>',
            '<div class="evento-modal-content">',
            '<h3 class="evento-modal-title"></h3>',
            '<div class="evento-modal-meta">',
            '<span class="evento-modal-label">LUGAR</span>',
            '<p class="evento-modal-place"></p>',
            '</div>',
            '<div class="evento-modal-meta">',
            '<span class="evento-modal-label">FECHA Y HORA</span>',
            '<p class="evento-modal-date"></p>',
            '</div>',
            '<div class="evento-modal-meta">',
            '<span class="evento-modal-label">DISTANCIAS</span>',
            '<div class="evento-modal-distances"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-link-block">',
            '<span class="evento-modal-label">ENLACE</span>',
            '<div class="evento-modal-link-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-inscripcion-block">',
            '<span class="evento-modal-label">INSCRIPCIONES EN LINEA</span>',
            '<div class="evento-modal-inscripcion-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-whatsapp-block">',
            '<span class="evento-modal-label">WHATSAPP</span>',
            '<div class="evento-modal-whatsapp-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-description-block">',
            '<p class="evento-modal-description"></p>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.classList.remove('is-open');
            }
        });

        overlay.querySelector('.evento-modal-close').addEventListener('click', function() {
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
        const inscripcionWrap = modal.querySelector('.evento-modal-inscripcion-wrap');
        const whatsappWrap = modal.querySelector('.evento-modal-whatsapp-wrap');
        const inscripcionBlock = modal.querySelector('.evento-modal-inscripcion-block');
        const whatsappBlock = modal.querySelector('.evento-modal-whatsapp-block');
        const descripcion = modal.querySelector('.evento-modal-description');
        const descripcionBlock = modal.querySelector('.evento-modal-description-block');

        const datos = evento.extendedProps || {};
        const url = (datos.link || '').trim();
        const inscripcionUrl = (datos.inscripcionesonline || datos.inscripciononline || '').trim();
        const whatsappTexto = (datos.whatsapp || '').trim();
        const imagenUrl = (datos.imagen || '').trim();
        const tituloTexto = datos.titulo || evento.title || 'Evento deportivo';
        const lugarBase = (datos.lugar || '').trim();
        const estadoBase = (datos.estado || '').trim();
        const lugarTexto = estadoBase ? (lugarBase + ', ' + estadoBase) : (lugarBase || 'Sin lugar especificado');
        const fechaTexto = datos.fechaFormateada || formatearFecha(evento.start || datos.fecha_hora);
        const distanciasTexto = datos.distancias || '';
        const descripcionTexto = datos.descripcion || '';

        titulo.textContent = tituloTexto;
        lugar.textContent = lugarTexto;
        fecha.textContent = fechaTexto;
        descripcion.textContent = descripcionTexto || '';
        descripcionBlock.style.display = descripcionTexto ? '' : 'none';

        if (imagenUrl) {
            imagen.src = imagenUrl;
            imagen.style.display = 'block';
        } else {
            imagen.removeAttribute('src');
            imagen.style.display = 'none';
        }

        distancias.innerHTML = '';
        if (distanciasTexto) {
            String(distanciasTexto)
                .split(',')
                .map(function(item) { return item.trim(); })
                .filter(Boolean)
                .forEach(function(item) {
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

        inscripcionWrap.innerHTML = '';
        if (inscripcionUrl) {
            const enlaceInscripcion = document.createElement('a');
            enlaceInscripcion.className = 'evento-modal-url-link';
            enlaceInscripcion.href = inscripcionUrl;
            enlaceInscripcion.target = '_blank';
            enlaceInscripcion.rel = 'noopener noreferrer';
            enlaceInscripcion.textContent = inscripcionUrl;
            inscripcionWrap.appendChild(enlaceInscripcion);
            inscripcionBlock.style.display = '';
        } else {
            inscripcionBlock.style.display = 'none';
        }

        whatsappWrap.innerHTML = '';
        if (whatsappTexto) {
            const itemsWhatsapp = whatsappTexto
                .split(/[\n,;]+/)
                .map(function(item) { return item.trim(); })
                .filter(Boolean);

            itemsWhatsapp.forEach(function(item) {
                const enlaceWhatsapp = document.createElement('a');
                enlaceWhatsapp.className = 'evento-modal-url-link';
                if (/^https?:\/\//i.test(item)) {
                    enlaceWhatsapp.href = item;
                    enlaceWhatsapp.textContent = item;
                } else {
                    const soloDigitos = item.replace(/\D/g, '');
                    enlaceWhatsapp.href = 'https://wa.me/' + soloDigitos;
                    enlaceWhatsapp.textContent = item;
                }
                enlaceWhatsapp.target = '_blank';
                enlaceWhatsapp.rel = 'noopener noreferrer';
                whatsappWrap.appendChild(enlaceWhatsapp);
            });
            whatsappBlock.style.display = '';
        } else {
            whatsappBlock.style.display = 'none';
        }

        modal.classList.add('is-open');
    }

    function crearModalBusquedaEventos() {
        if (document.getElementById('evento-search-modal')) {
            return document.getElementById('evento-search-modal');
        }

        const overlay = document.createElement('div');
        overlay.id = 'evento-search-modal';
        overlay.className = 'evento-search-modal-overlay';
        overlay.innerHTML = [
            '<div class="evento-search-modal-card" role="dialog" aria-modal="true" aria-labelledby="evento-search-modal-title">',
            '<button type="button" class="evento-search-modal-close" aria-label="Cerrar busqueda">×</button>',
            '<h3 id="evento-search-modal-title" class="evento-search-modal-title">Busqueda avanzada</h3>',
            '<p class="evento-search-modal-shortcut">Atajo: Ctrl+K / Cmd+K</p>',
            '<input type="text" id="evento-search-modal-input" class="evento-search-modal-input" autocomplete="off" placeholder="Buscar por nombre de evento..." aria-label="Buscar por nombre de evento">',
            '<div id="evento-search-modal-status" class="evento-search-modal-status" aria-live="polite"></div>',
            '<ul id="evento-search-modal-results" class="evento-search-modal-results" role="listbox" aria-label="Resultados de busqueda"></ul>',
            '</div>'
        ].join('');

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                cerrarModalBusquedaEventos();
            }
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function obtenerElementosModalBusqueda() {
        const modal = crearModalBusquedaEventos();
        return {
            modal: modal,
            close: modal.querySelector('.evento-search-modal-close'),
            input: modal.querySelector('#evento-search-modal-input'),
            status: modal.querySelector('#evento-search-modal-status'),
            results: modal.querySelector('#evento-search-modal-results')
        };
    }

    function resaltarEventoCalendario(evento) {
        if (!evento || !evento.id) return;

        const selector = '#calendario .fc-event[data-event-id="' + escaparParaSelector(evento.id) + '"]';
        const elementos = document.querySelectorAll(selector);
        elementos.forEach(function(elemento) {
            elemento.classList.add('evento-busqueda-highlight');
            setTimeout(function() {
                elemento.classList.remove('evento-busqueda-highlight');
            }, 1800);
        });
    }

    function enfocarEventoEnCalendario(eventoDatos) {
        if (!calendarioInstancia) return;

        const fecha = detectarFecha(eventoDatos);
        if (fecha) {
            calendarioInstancia.gotoDate(fecha);
        }

        const claveObjetivo = construirClaveEvento(eventoDatos);
        setTimeout(function() {
            if (!calendarioInstancia) return;
            const eventoCalendario = calendarioInstancia.getEvents().find(function(evento) {
                const claveExistente = (evento.extendedProps && evento.extendedProps.busquedaClave) || construirClaveEventoDesdeDatos(
                    evento.extendedProps && evento.extendedProps.titulo ? evento.extendedProps.titulo : evento.title,
                    evento.extendedProps && evento.extendedProps.fecha_hora ? evento.extendedProps.fecha_hora : evento.startStr,
                    evento.extendedProps && evento.extendedProps.lugar ? evento.extendedProps.lugar : ''
                );
                return claveExistente === claveObjetivo;
            });
            if (!eventoCalendario) return;
            resaltarEventoCalendario(eventoCalendario);
            mostrarDetalleEvento(eventoCalendario);
        }, 180);
    }

    function obtenerEventosFiltradosPorChecks() {
        const tiposCheck = Array.from(document.querySelectorAll('#filtro-tipo-container input:checked')).map(function(input) {
            return input.value;
        });
        const lugaresCheck = Array.from(document.querySelectorAll('#filtro-lugar-container input:checked')).map(function(input) {
            return input.value;
        });

        return obtenerEventosPublicosBase().filter(function(evento) {
            const eventoTipos = obtenerTiposArray(evento);
            const eventoLugar = obtenerPropiedad(evento, 'lugar');

            const coincideTipo = tiposCheck.length === 0 || tiposCheck.some(function(tipoFiltro) {
                return eventoTipos.some(function(tipoEvento) {
                    return tipoEvento.toLowerCase() === tipoFiltro.toLowerCase();
                });
            });
            const coincideLugar = lugaresCheck.length === 0 || lugaresCheck.some(function(lugarFiltro) {
                return String(eventoLugar).toLowerCase() === lugarFiltro.toLowerCase();
            });

            return coincideTipo && coincideLugar;
        });
    }

    function obtenerResultadosBusquedaModal(termino) {
        const terminoNormalizado = normalizarTextoBusqueda(termino);
        if (!terminoNormalizado) {
            return [];
        }

        return obtenerEventosFiltradosPorChecks()
            .filter(function(evento) {
                return normalizarTextoBusqueda(detectarTitulo(evento)).includes(terminoNormalizado);
            })
            .slice(0, 30);
    }

    function actualizarIndiceActivoBusquedaModal(indiceNuevo) {
        const elementos = obtenerElementosModalBusqueda();
        const opciones = Array.from(elementos.results.querySelectorAll('.evento-search-result-option'));
        if (opciones.length === 0) {
            indiceActivoBusquedaModal = -1;
            elementos.input.removeAttribute('aria-activedescendant');
            return;
        }

        const indiceNormalizado = Math.max(0, Math.min(indiceNuevo, opciones.length - 1));
        indiceActivoBusquedaModal = indiceNormalizado;
        opciones.forEach(function(opcion, indice) {
            const activo = indice === indiceActivoBusquedaModal;
            opcion.classList.toggle('is-active', activo);
            opcion.setAttribute('aria-selected', activo ? 'true' : 'false');
            if (activo) {
                elementos.input.setAttribute('aria-activedescendant', opcion.id);
                opcion.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function seleccionarResultadoBusquedaModal(indice) {
        const evento = resultadosBusquedaModal[indice];
        if (!evento) return;

        registrarAnaliticaBusqueda('result_click', {
            term: terminoBusquedaModal,
            result_position: indice + 1,
            event_title: detectarTitulo(evento)
        });

        const inputPublico = document.getElementById('evento-search-input');
        const tituloSeleccionado = detectarTitulo(evento);
        if (inputPublico) {
            inputPublico.value = tituloSeleccionado;
        }
        terminoBusqueda = tituloSeleccionado.toLowerCase();
        actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
        cerrarModalBusquedaEventos();
        enfocarEventoEnCalendario(evento);
    }

    function renderizarResultadosBusquedaModal() {
        const elementos = obtenerElementosModalBusqueda();
        const terminoVisible = terminoBusquedaModal.trim();
        elementos.results.innerHTML = '';

        if (!terminoVisible) {
            elementos.status.textContent = 'Escribe para buscar eventos por nombre.';
            indiceActivoBusquedaModal = -1;
            return;
        }

        resultadosBusquedaModal = obtenerResultadosBusquedaModal(terminoVisible);
        elementos.status.textContent = resultadosBusquedaModal.length
            ? resultadosBusquedaModal.length + ' resultado(s) encontrados'
            : 'No hay resultados para "' + terminoVisible + '".';

        if (terminoVisible !== ultimoTerminoAnaliticaModal) {
            registrarAnaliticaBusqueda('search_term', {
                term: terminoVisible,
                results: resultadosBusquedaModal.length
            });
            ultimoTerminoAnaliticaModal = terminoVisible;
        }

        resultadosBusquedaModal.forEach(function(evento, indice) {
            const titulo = detectarTitulo(evento);
            const fecha = formatearFecha(detectarFecha(evento));
            const lugar = obtenerPropiedad(evento, 'lugar') || 'Sin lugar';
            const tipos = obtenerTiposArray(evento).join(' · ') || 'Sin tipo';

            const li = document.createElement('li');
            li.className = 'evento-search-result-item';

            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'evento-search-result-option';
            boton.id = 'evento-search-option-' + indice;
            boton.setAttribute('role', 'option');
            boton.setAttribute('aria-selected', 'false');
            boton.innerHTML = [
                '<span class="evento-search-result-title"></span>',
                '<span class="evento-search-result-meta"></span>',
                '<span class="evento-search-result-type"></span>'
            ].join('');
            boton.querySelector('.evento-search-result-title').textContent = titulo;
            boton.querySelector('.evento-search-result-meta').textContent = (fecha || 'Fecha pendiente') + ' · ' + lugar;
            boton.querySelector('.evento-search-result-type').textContent = tipos;
            boton.addEventListener('mouseenter', function() {
                actualizarIndiceActivoBusquedaModal(indice);
            });
            boton.addEventListener('click', function() {
                seleccionarResultadoBusquedaModal(indice);
            });

            li.appendChild(boton);
            elementos.results.appendChild(li);
        });

        actualizarIndiceActivoBusquedaModal(0);
    }

    function abrirModalBusquedaEventos(valorInicial) {
        const elementos = obtenerElementosModalBusqueda();
        ultimoElementoConFoco = document.activeElement;
        elementos.modal.classList.add('is-open');
        terminoBusquedaModal = String(valorInicial || '').trim();
        elementos.input.value = terminoBusquedaModal;
        renderizarResultadosBusquedaModal();
        setTimeout(function() {
            elementos.input.focus();
            elementos.input.select();
        }, 0);
    }

    function cerrarModalBusquedaEventos() {
        const elementos = obtenerElementosModalBusqueda();
        elementos.modal.classList.remove('is-open');
        indiceActivoBusquedaModal = -1;
        resultadosBusquedaModal = [];
        terminoBusquedaModal = '';
        elementos.input.value = '';
        elementos.input.removeAttribute('aria-activedescendant');
        elementos.results.innerHTML = '';
        elementos.status.textContent = '';
        if (ultimoElementoConFoco && typeof ultimoElementoConFoco.focus === 'function') {
            ultimoElementoConFoco.focus();
        }
    }

    function inicializarBusquedaModalEventos(searchModalTrigger, searchInput) {
        const elementos = obtenerElementosModalBusqueda();
        let timeoutBusquedaModal;

        elementos.close.addEventListener('click', function() {
            cerrarModalBusquedaEventos();
        });

        elementos.input.addEventListener('input', function(e) {
            clearTimeout(timeoutBusquedaModal);
            timeoutBusquedaModal = setTimeout(function() {
                terminoBusquedaModal = String(e.target.value || '').trim();
                renderizarResultadosBusquedaModal();
            }, 180);
        });

        elementos.input.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                actualizarIndiceActivoBusquedaModal(indiceActivoBusquedaModal + 1);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                actualizarIndiceActivoBusquedaModal(indiceActivoBusquedaModal - 1);
                return;
            }
            if (e.key === 'Enter') {
                if (indiceActivoBusquedaModal >= 0) {
                    e.preventDefault();
                    seleccionarResultadoBusquedaModal(indiceActivoBusquedaModal);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cerrarModalBusquedaEventos();
            }
        });

        searchModalTrigger.addEventListener('click', function() {
            abrirModalBusquedaEventos(searchInput ? searchInput.value : '');
        });

        document.addEventListener('keydown', function(e) {
            const tecla = String(e.key || '').toLowerCase();
            const atajoBusqueda = (e.ctrlKey || e.metaKey) && tecla === 'k';
            if (atajoBusqueda) {
                e.preventDefault();
                abrirModalBusquedaEventos(searchInput ? searchInput.value : '');
            } else if (tecla === 'escape' && elementos.modal.classList.contains('is-open')) {
                e.preventDefault();
                cerrarModalBusquedaEventos();
            }
        });
    }

    function ejecutarInicializacion() {
        const contenedorTipo = document.getElementById('filtro-tipo-container');
        const contenedorLugar = document.getElementById('filtro-lugar-container');
        const contenedorCalendario = document.getElementById('calendario');
        const searchInput = document.getElementById('evento-search-input');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const searchModalTrigger = document.getElementById('search-modal-trigger');

        if (!contenedorTipo || !contenedorLugar || !contenedorCalendario) {
            return false;
        }

        if (contenedorCalendario.dataset.fcInicializado === 'true') {
            return true;
        }

        contenedorCalendario.dataset.fcInicializado = 'true';

        const basePublica = obtenerEventosPublicosBase();
        generarCheckboxes(basePublica, 'tipos', 'filtro-tipo-container');
        generarCheckboxes(basePublica, 'lugar', 'filtro-lugar-container');
        if (searchInput && clearSearchBtn) {
            inicializarBuscadorEventos(searchInput, clearSearchBtn);
        }
        if (searchModalTrigger) {
            inicializarBusquedaModalEventos(searchModalTrigger, searchInput);
        }
        actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
        return true;
    }

    function inicializarBuscadorEventos(searchInput, clearSearchBtn) {
        let searchTimeout;

        function actualizarUIBuscador() {
            clearSearchBtn.style.display = terminoBusqueda ? 'inline-flex' : 'none';
        }

        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                terminoBusqueda = String(e.target.value || '').trim().toLowerCase();
                actualizarUIBuscador();
                actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
            }, 300);
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                searchInput.value = '';
                terminoBusqueda = '';
                actualizarUIBuscador();
                actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
            }
        });

        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            terminoBusqueda = '';
            actualizarUIBuscador();
            searchInput.focus();
            actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
        });

        actualizarUIBuscador();
    }

    function generarCheckboxes(eventos, propiedad, contenedorId) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        const conteoValores = {};

        eventos.forEach(function(evento) {
            const valorRaw = obtenerPropiedad(evento, propiedad);
            if (!valorRaw || valorRaw === 'N/A' || String(valorRaw).trim() === '') return;

            String(valorRaw).split(/[,/]/).forEach(function(valor) {
                const valorLimpio = valor.trim();
                if (valorLimpio) {
                    conteoValores[valorLimpio] = (conteoValores[valorLimpio] || 0) + 1;
                }
            });
        });

        let opcionesOrdenadas = Object.keys(conteoValores);
        if (propiedad === 'lugar') {
            opcionesOrdenadas = ordenarOpcionesLugar(opcionesOrdenadas, conteoValores);
        } else {
            opcionesOrdenadas = ordenarOpcionesTipo(opcionesOrdenadas);
        }

        contenedor.innerHTML = '';
        opcionesOrdenadas.forEach(function(opcion) {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.innerHTML = '<div><input type="checkbox" value="' + opcion + '" style="margin-right:8px;"><span>' + opcion + '</span></div>';
            label.querySelector('input').addEventListener('change', function() {
                actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
            });
            contenedor.appendChild(label);
        });
    }

    function calcularDiasAOcultar(eventosFiltrados, rangoVisible) {
        const diasSemanaOcultables = [1, 2, 3, 4, 5];
        const diasConEventos = new Set();

        eventosFiltrados.forEach(function(evento) {
            const fechaEvento = detectarFecha(evento);
            if (!fechaEvento) return;

            const fechaPlana = String(fechaEvento).split(/[T ]/)[0];
            const partes = fechaPlana.split('-');
            if (partes.length !== 3) return;

            const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
            if (!Number.isNaN(fecha.getTime())) {
                if (rangoVisible && (fecha < rangoVisible.inicio || fecha >= rangoVisible.fin)) {
                    return;
                }
                diasConEventos.add(fecha.getDay());
            }
        });

        return diasSemanaOcultables.filter(function(dia) {
            return !diasConEventos.has(dia);
        });
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
        requestAnimationFrame(function() {
            calendarioInstancia.updateSize();
            setTimeout(function() {
                if (calendarioInstancia) {
                    calendarioInstancia.updateSize();
                }
            }, 180);
            setTimeout(function() {
                if (calendarioInstancia) {
                    calendarioInstancia.updateSize();
                }
            }, 650);
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

    function inicializarGridMensual(eventos) {
        const contenedorEl = document.getElementById('calendario');
        const eventosMapeados = mapearEventos(eventos);
        const diasAOcultarInicial = calcularDiasAOcultar(eventos, rangoVisibleMes);

        if (calendarioInstancia) {
            calendarioInstancia.destroy();
            calendarioInstancia = null;
        }

        calendarioInstancia = new FullCalendar.Calendar(contenedorEl, {
            initialView: 'dayGridMonth',
            handleWindowResize: true,
            height: 'auto',
            contentHeight: 'auto',
            expandRows: true,
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
                const colores = obtenerColorPorTipos(info.event.extendedProps && info.event.extendedProps.tipos ? info.event.extendedProps.tipos : []);
                const el = info.el;
                if (!el) return;
                el.style.backgroundColor = colores.backgroundColor;
                el.style.borderColor = colores.borderColor;
                el.style.color = colores.textColor;
                el.style.opacity = '1';
                el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.12)';
                const title = el.querySelector('.fc-event-title');
                if (title) title.style.color = colores.textColor;
            },
            eventClick: function(info) {
                info.jsEvent.preventDefault();
                mostrarDetalleEvento(info.event);
            },
            datesSet: function(info) {
                rangoVisibleMes = { inicio: new Date(info.start), fin: new Date(info.end) };
                aplicarDiasOcultosPorMes(obtenerEventosFiltradosActuales());
                forzarRecalculoTamanoCalendario();
            }
        });

        calendarioInstancia.render();
        forzarRecalculoTamanoCalendario();
        window.addEventListener('resize', forzarRecalculoTamanoCalendario);
        window.addEventListener('load', forzarRecalculoTamanoCalendario);
        window.addEventListener('pageshow', forzarRecalculoTamanoCalendario);
    }

    function obtenerEventosFiltradosActuales() {
        return obtenerEventosFiltradosPorChecks().filter(function(evento) {
            const titulo = detectarTitulo(evento).toLowerCase();
            const coincideBusqueda = terminoBusqueda === '' || titulo.includes(terminoBusqueda);
            return coincideBusqueda;
        });
    }

    function mapearEventos(eventos) {
        return eventos.map(function(evento, index) {
            const titulo = detectarTitulo(evento);
            const fecha = detectarFecha(evento);
            const link = obtenerPropiedad(evento, 'link');
            const lugar = obtenerPropiedad(evento, 'lugar');
            const estado = obtenerPropiedad(evento, 'estado');
            const distancias = obtenerPropiedad(evento, 'distancias');
            const imagen = obtenerPropiedad(evento, 'imagen');
            const descripcion = obtenerPropiedad(evento, 'descripcion');
            const inscripcionOnLine = obtenerPropiedad(evento, 'inscripciononline');
            const whatsapp = obtenerPropiedad(evento, 'whatsapp');
            const tiposArray = obtenerTiposArray(evento);
            const colores = obtenerColorPorTipos(tiposArray);
            const claveBusqueda = construirClaveEvento(evento);
            const claveBusquedaId = encodeURIComponent(claveBusqueda);

            return {
                id: 'evento-' + index + '-' + claveBusquedaId,
                title: titulo,
                start: fecha ? String(fecha).trim() : null,
                url: link,
                allDay: false,
                backgroundColor: colores.backgroundColor,
                borderColor: colores.borderColor,
                textColor: colores.textColor,
                classNames: ['evento-calendario'],
                extendedProps: {
                    titulo: titulo,
                    lugar: lugar,
                    estado: estado,
                    distancias: distancias,
                    imagen: imagen,
                    descripcion: descripcion,
                    inscripciononline: inscripcionOnLine,
                    inscripcionesonline: inscripcionOnLine,
                    whatsapp: whatsapp,
                    link: link,
                    fecha_hora: fecha,
                    fechaFormateada: formatearFecha(fecha),
                    tipos: tiposArray,
                    busquedaClave: claveBusqueda
                }
            };
        }).filter(function(evento) {
            return evento.start !== null;
        });
    }

    function actualizarCalendarioDinamico(eventosFiltrados) {
        if (!calendarioInstancia) {
            inicializarGridMensual(eventosFiltrados);
            return;
        }

        aplicarDiasOcultosPorMes(eventosFiltrados);
        calendarioInstancia.removeAllEvents();
        calendarioInstancia.addEventSource(mapearEventos(eventosFiltrados));
        forzarRecalculoTamanoCalendario();
    }
})();
