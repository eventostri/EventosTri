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
    let indiceActivoBusquedaInline = -1;
    let resultadosBusquedaInline = [];
    let timeoutBlurBusquedaInline = null;
    const pilaHistorialModales = [];
    let omitirSiguientePopstateModal = false;
    let swipeNavegacionInicializada = false;
    const CLAVE_ANALITICA_BUSQUEDA = '__eventostriSearchAnalytics';
    const CLAVE_FILTROS_AVANZADOS_PUBLIC = '__eventostriSearchAdvancedFiltersPublic';
    const CLAVE_FILTROS_CHECKS_PUBLIC = '__eventostriSearchCheckFiltersPublic';
    const calendarioConfig = window.eventostriCalendarioConfig || {};
    const calendarioRestConfig = calendarioConfig.rest || {};
    const calendarioSettingsConfig = calendarioConfig.settings || {};
    const defaultEventImageUrl = String(calendarioSettingsConfig.default_event_image_url || '').trim();
    const urlJSON = calendarioRestConfig.eventosUrl || calendarioConfig.eventosUrl || '/wp-json/eventostri/v1/eventos';
    let filtrosAvanzadosBusqueda = {
        dateFrom: '',
        dateTo: '',
        distanceMin: '',
        distanceMax: '',
        organizer: '',
        status: '',
        maxDistance: ''
    };
    let filtrosChecksPersistidos = { tipos: [], lugar: [] };

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
            const config = (window.eventostriCalendarioConfig && window.eventostriCalendarioConfig.settings && window.eventostriCalendarioConfig.settings.tipo_colors) 
                ? window.eventostriCalendarioConfig.settings.tipo_colors 
                : {};
            resolvedColor = config.default_color || '#95E1D3,#76B8B0,#ffffff';
        }
        return parseColorString(resolvedColor);
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

        const diaSemanaFmt = diaSemana.replace(/(^|\s)([a-zÃ¡Ã©Ã­Ã³ÃºÃ±])/gi, function(match, espacio, letra) {
            return espacio + letra.toUpperCase();
        });
        const diaFmt = dia.replace(/^0/, '');
        const mesFmt = mes.replace(/(^|\s)([a-zÃ¡Ã©Ã­Ã³ÃºÃ±])/gi, function(match, espacio, letra) {
            return espacio + letra.toUpperCase();
        });
        const horaFmt = hora.replace(/\s/g, '').replace(/\./g, '').replace(/(?<=\d)(AM|PM)/i, ' $1');

        return diaSemanaFmt + ', ' + diaFmt + ' de ' + mesFmt + ' de ' + anio + ' Â· ' + horaFmt;
    }

    function normalizarTextoBusqueda(valor) {
        const base = String(valor || '').toLowerCase().trim();
        if (typeof base.normalize === 'function') {
            return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return base;
    }

    function cargarJSONLocalStorage(clave, fallback) {
        try {
            const raw = localStorage.getItem(clave);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function guardarJSONLocalStorage(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
        } catch (error) {
            return;
        }
    }

    function parsearDistanciasEvento(evento) {
        const distanciasRaw = String(obtenerPropiedad(evento, 'distancias') || '');
        return distanciasRaw
            .split(/[,;/]+/)
            .map(function(item) {
                const match = String(item).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
                return match ? parseFloat(match[1]) : NaN;
            })
            .filter(function(valor) { return !Number.isNaN(valor); });
    }

    function eventoCoincideFiltrosAvanzados(evento, filtros) {
        const fechaEvento = detectarFecha(evento);
        const fechaBase = fechaEvento ? String(fechaEvento).split(/[T ]/)[0] : '';
        const organizer = normalizarTextoBusqueda(obtenerPropiedad(evento, 'organizador') || '');
        const status = normalizarTextoBusqueda(obtenerPropiedad(evento, 'estado') || '');
        const distancias = parsearDistanciasEvento(evento);
        const minDist = distancias.length ? Math.min.apply(null, distancias) : null;
        const maxDist = distancias.length ? Math.max.apply(null, distancias) : null;

        if (filtros.dateFrom && (!fechaBase || fechaBase < filtros.dateFrom)) return false;
        if (filtros.dateTo && (!fechaBase || fechaBase > filtros.dateTo)) return false;
        if (filtros.organizer && !organizer.includes(normalizarTextoBusqueda(filtros.organizer))) return false;
        if (filtros.status && status !== normalizarTextoBusqueda(filtros.status)) return false;

        if (filtros.distanceMin !== '') {
            const distanceMin = parseFloat(filtros.distanceMin);
            if (!Number.isNaN(distanceMin) && (maxDist === null || maxDist < distanceMin)) return false;
        }
        if (filtros.distanceMax !== '') {
            const distanceMax = parseFloat(filtros.distanceMax);
            if (!Number.isNaN(distanceMax) && (minDist === null || minDist > distanceMax)) return false;
        }
        if (filtros.maxDistance !== '' && typeof navigator !== 'undefined' && navigator.geolocation) {
            const maxDistance = parseFloat(filtros.maxDistance);
            if (!Number.isNaN(maxDistance) && (minDist === null || minDist > maxDistance)) return false;
        }
        return true;
    }

    function contarFiltrosAvanzadosActivos(filtros) {
        const keys = ['dateFrom', 'dateTo', 'distanceMin', 'distanceMax', 'organizer', 'status', 'maxDistance'];
        return keys.reduce(function(total, key) {
            return total + (String(filtros[key] || '').trim() ? 1 : 0);
        }, 0);
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

    function registrarModalEnHistorial(modalId) {
        if (!window.history || typeof window.history.pushState !== 'function') {
            return;
        }

        window.history.pushState({ eventostriModal: modalId }, document.title);
        pilaHistorialModales.push(modalId);
    }

    function removerModalDeHistorial(modalId, desdePopstate) {
        const index = pilaHistorialModales.lastIndexOf(modalId);
        if (index === -1) {
            return;
        }

        pilaHistorialModales.splice(index, 1);
        if (!desdePopstate && window.history && typeof window.history.back === 'function') {
            omitirSiguientePopstateModal = true;
            window.history.back();
        }
    }

    function cerrarModalDetalleEvento(desdePopstate) {
        const modal = document.getElementById('modal-evento-calendario');
        if (!modal || !modal.classList.contains('is-open')) {
            return;
        }
        modal.classList.remove('is-open');
        removerModalDeHistorial('detalle', Boolean(desdePopstate));
    }

    function inicializarGestorBackGesturesModales() {
        if (window.__eventostriModalBackGesturesInicializado) {
            return;
        }
        window.__eventostriModalBackGesturesInicializado = true;

        window.addEventListener('popstate', function() {
            if (omitirSiguientePopstateModal) {
                omitirSiguientePopstateModal = false;
                return;
            }

            const ultimoModal = pilaHistorialModales[pilaHistorialModales.length - 1];
            if (!ultimoModal) {
                return;
            }

            if (ultimoModal === 'search') {
                cerrarModalBusquedaEventos(true);
                return;
            }

            if (ultimoModal === 'detalle') {
                cerrarModalDetalleEvento(true);
            }
        });
    }

    function inicializarNavegacionSwipeCalendario(contenedor) {
        if (swipeNavegacionInicializada || !contenedor) {
            return;
        }
        swipeNavegacionInicializada = true;

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
            const target = event.target;
            if (target && target.closest('button, a, input, select, textarea')) {
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

            // swipe left (deltaX < 0) → advance; swipe right (deltaX > 0) → go back
            if (deltaX < 0) {
                calendarioInstancia.next();
            } else {
                calendarioInstancia.prev();
            }
        }, { passive: true });
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
            '<button class="evento-modal-close" aria-label="Cerrar detalle">&times;</button>',
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
                cerrarModalDetalleEvento(false);
            }
        });

        overlay.querySelector('.evento-modal-close').addEventListener('click', function() {
            cerrarModalDetalleEvento(false);
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function mostrarDetalleEvento(evento) {
        const modal = crearModalEvento();
        const imageWrap = modal.querySelector('.evento-modal-image-wrap');
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
        const imagenResuelta = (datos.resolvedImage || datos.resolvedimage || '').trim();
        const imagenFinal = imagenUrl || imagenResuelta || defaultEventImageUrl;
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

        if (imagenFinal) {
            imagen.src = imagenFinal;
            imagen.style.display = 'block';
            imageWrap.style.display = '';
        } else {
            imagen.removeAttribute('src');
            imagen.style.display = 'none';
            imageWrap.style.display = 'none';
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

        const modalYaAbierto = modal.classList.contains('is-open');
        modal.classList.add('is-open');
        if (!modalYaAbierto) {
            registrarModalEnHistorial('detalle');
        }
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
            '<button type="button" class="evento-search-modal-close" aria-label="Cerrar busqueda">&times;</button>',
            '<h3 id="evento-search-modal-title" class="evento-search-modal-title">Busqueda avanzada</h3>',
            '<p class="evento-search-modal-shortcut">Atajo: Ctrl+K / Cmd+K</p>',
            '<div class="evento-search-modal-filters" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Fecha desde<input type="date" id="evento-search-filter-date-from"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Fecha hasta<input type="date" id="evento-search-filter-date-to"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Distancia mínima (km)<input type="number" step="0.1" min="0" id="evento-search-filter-distance-min" placeholder="5"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Distancia máxima (km)<input type="number" step="0.1" min="0" id="evento-search-filter-distance-max" placeholder="42"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Organizador<input type="text" id="evento-search-filter-organizer" placeholder="Nombre organizador"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Estado<input type="text" id="evento-search-filter-status" placeholder="YUC/CAM/QROO"></label>',
            '<label style="display:flex;flex-direction:column;font-size:12px;">Max distancia (km)<input type="number" step="0.1" min="0" id="evento-search-filter-max-distance" placeholder="Opcional"></label>',
            '<div style="display:flex;align-items:end;gap:8px;"><span id="evento-search-filter-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 8px;border-radius:999px;background:#e2e8f0;font-size:12px;">0</span><button type="button" id="evento-search-filter-clear" class="button">Limpiar filtros</button></div>',
            '</div>',
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
            results: modal.querySelector('#evento-search-modal-results'),
            filterDateFrom: modal.querySelector('#evento-search-filter-date-from'),
            filterDateTo: modal.querySelector('#evento-search-filter-date-to'),
            filterDistanceMin: modal.querySelector('#evento-search-filter-distance-min'),
            filterDistanceMax: modal.querySelector('#evento-search-filter-distance-max'),
            filterOrganizer: modal.querySelector('#evento-search-filter-organizer'),
            filterStatus: modal.querySelector('#evento-search-filter-status'),
            filterMaxDistance: modal.querySelector('#evento-search-filter-max-distance'),
            filterBadge: modal.querySelector('#evento-search-filter-badge'),
            filterClear: modal.querySelector('#evento-search-filter-clear')
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
            const selector = '#calendario .fc-event[data-event-id="' + escaparParaSelector(eventoCalendario.id) + '"]';
            const elemento = document.querySelector(selector);
            if (elemento) {
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                elemento.setAttribute('tabindex', '-1');
                elemento.focus({ preventScroll: true });
            }
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

    function obtenerResultadosBusqueda(termino, limite) {
        const terminoNormalizado = normalizarTextoBusqueda(termino);
        if (!terminoNormalizado) {
            return [];
        }

        return obtenerEventosFiltradosPorChecks()
            .filter(function(evento) {
                return normalizarTextoBusqueda(detectarTitulo(evento)).includes(terminoNormalizado);
            })
            .slice(0, limite);
    }

    function obtenerResultadosBusquedaModal(termino) {
        return obtenerResultadosBusqueda(termino, 30).filter(function(evento) {
            return eventoCoincideFiltrosAvanzados(evento, filtrosAvanzadosBusqueda);
        });
    }

    function obtenerResultadosBusquedaInline(termino) {
        return obtenerResultadosBusqueda(termino, 10);
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
        const filtrosActivos = contarFiltrosAvanzadosActivos(filtrosAvanzadosBusqueda);
        elementos.results.innerHTML = '';
        if (elementos.filterBadge) {
            elementos.filterBadge.textContent = String(filtrosActivos);
        }

        if (!terminoVisible) {
            elementos.status.textContent = 'Escribe para buscar eventos por nombre.' + (filtrosActivos ? (' Filtros activos: ' + filtrosActivos + '.') : '');
            indiceActivoBusquedaModal = -1;
            return;
        }

        resultadosBusquedaModal = obtenerResultadosBusquedaModal(terminoVisible);
        elementos.status.textContent = resultadosBusquedaModal.length
            ? resultadosBusquedaModal.length + ' resultado(s) encontrados' + (filtrosActivos ? (' · Filtros: ' + filtrosActivos) : '')
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
            const tipos = obtenerTiposArray(evento).join(' Â· ') || 'Sin tipo';

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
            boton.querySelector('.evento-search-result-meta').textContent = (fecha || 'Fecha pendiente') + ' Â· ' + lugar;
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
        const modalYaAbierto = elementos.modal.classList.contains('is-open');
        elementos.modal.classList.add('is-open');
        if (!modalYaAbierto) {
            registrarModalEnHistorial('search');
        }
        elementos.filterDateFrom.value = filtrosAvanzadosBusqueda.dateFrom || '';
        elementos.filterDateTo.value = filtrosAvanzadosBusqueda.dateTo || '';
        elementos.filterDistanceMin.value = filtrosAvanzadosBusqueda.distanceMin || '';
        elementos.filterDistanceMax.value = filtrosAvanzadosBusqueda.distanceMax || '';
        elementos.filterOrganizer.value = filtrosAvanzadosBusqueda.organizer || '';
        elementos.filterStatus.value = filtrosAvanzadosBusqueda.status || '';
        elementos.filterMaxDistance.value = filtrosAvanzadosBusqueda.maxDistance || '';
        terminoBusquedaModal = String(valorInicial || '').trim();
        elementos.input.value = terminoBusquedaModal;
        renderizarResultadosBusquedaModal();
        setTimeout(function() {
            elementos.input.focus();
            elementos.input.select();
        }, 0);
    }

    function cerrarModalBusquedaEventos(desdePopstate) {
        const elementos = obtenerElementosModalBusqueda();
        elementos.modal.classList.remove('is-open');
        indiceActivoBusquedaModal = -1;
        resultadosBusquedaModal = [];
        terminoBusquedaModal = '';
        elementos.input.value = '';
        elementos.input.removeAttribute('aria-activedescendant');
        elementos.results.innerHTML = '';
        elementos.status.textContent = '';
        removerModalDeHistorial('search', Boolean(desdePopstate));
        if (ultimoElementoConFoco && typeof ultimoElementoConFoco.focus === 'function') {
            ultimoElementoConFoco.focus();
        }
    }

    function inicializarBusquedaModalEventos(searchInput) {
        const elementos = obtenerElementosModalBusqueda();
        let timeoutBusquedaModal;
        const actualizarFiltrosModal = function() {
            filtrosAvanzadosBusqueda = {
                dateFrom: String(elementos.filterDateFrom.value || '').trim(),
                dateTo: String(elementos.filterDateTo.value || '').trim(),
                distanceMin: String(elementos.filterDistanceMin.value || '').trim(),
                distanceMax: String(elementos.filterDistanceMax.value || '').trim(),
                organizer: String(elementos.filterOrganizer.value || '').trim(),
                status: String(elementos.filterStatus.value || '').trim(),
                maxDistance: String(elementos.filterMaxDistance.value || '').trim()
            };
            guardarJSONLocalStorage(CLAVE_FILTROS_AVANZADOS_PUBLIC, filtrosAvanzadosBusqueda);
            renderizarResultadosBusquedaModal();
        };

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

        [
            elementos.filterDateFrom,
            elementos.filterDateTo,
            elementos.filterDistanceMin,
            elementos.filterDistanceMax,
            elementos.filterOrganizer,
            elementos.filterStatus,
            elementos.filterMaxDistance
        ].forEach(function(control) {
            if (!control) return;
            control.addEventListener('input', actualizarFiltrosModal);
            control.addEventListener('change', actualizarFiltrosModal);
        });

        if (elementos.filterClear) {
            elementos.filterClear.addEventListener('click', function() {
                elementos.filterDateFrom.value = '';
                elementos.filterDateTo.value = '';
                elementos.filterDistanceMin.value = '';
                elementos.filterDistanceMax.value = '';
                elementos.filterOrganizer.value = '';
                elementos.filterStatus.value = '';
                elementos.filterMaxDistance.value = '';
                actualizarFiltrosModal();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('dblclick', function() {
                abrirModalBusquedaEventos(searchInput.value || '');
            });
        }

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

        if (!contenedorTipo || !contenedorLugar || !contenedorCalendario) {
            return false;
        }

        if (contenedorCalendario.dataset.fcInicializado === 'true') {
            return true;
        }

        contenedorCalendario.dataset.fcInicializado = 'true';
        filtrosAvanzadosBusqueda = Object.assign({
            dateFrom: '',
            dateTo: '',
            distanceMin: '',
            distanceMax: '',
            organizer: '',
            status: '',
            maxDistance: ''
        }, cargarJSONLocalStorage(CLAVE_FILTROS_AVANZADOS_PUBLIC, {}));
        filtrosChecksPersistidos = Object.assign({ tipos: [], lugar: [] }, cargarJSONLocalStorage(CLAVE_FILTROS_CHECKS_PUBLIC, {}));

        const basePublica = obtenerEventosPublicosBase();
        generarCheckboxes(basePublica, 'tipos', 'filtro-tipo-container');
        generarCheckboxes(basePublica, 'lugar', 'filtro-lugar-container');
        if (searchInput && clearSearchBtn) {
            inicializarBuscadorEventos(searchInput, clearSearchBtn);
        }
        inicializarGestorBackGesturesModales();
        inicializarBusquedaModalEventos(searchInput);
        actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
        return true;
    }

    function inicializarBuscadorEventos(searchInput, clearSearchBtn) {
        const resultadosInline = document.getElementById('evento-search-inline-results');
        let searchTimeout;

        function actualizarUIBuscador() {
            clearSearchBtn.style.display = terminoBusqueda ? 'inline-flex' : 'none';
        }

        function ocultarResultadosInline() {
            if (!resultadosInline) return;
            resultadosInline.hidden = true;
            resultadosInline.innerHTML = '';
            indiceActivoBusquedaInline = -1;
            resultadosBusquedaInline = [];
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.removeAttribute('aria-activedescendant');
        }

        function actualizarIndiceActivoInline(indiceNuevo) {
            if (!resultadosInline) return;
            const opciones = Array.from(resultadosInline.querySelectorAll('.evento-search-result-option'));
            if (opciones.length === 0) {
                indiceActivoBusquedaInline = -1;
                searchInput.removeAttribute('aria-activedescendant');
                return;
            }

            indiceActivoBusquedaInline = Math.max(0, Math.min(indiceNuevo, opciones.length - 1));
            opciones.forEach(function(opcion, indice) {
                const activo = indice === indiceActivoBusquedaInline;
                opcion.classList.toggle('is-active', activo);
                opcion.setAttribute('aria-selected', activo ? 'true' : 'false');
                if (activo) {
                    searchInput.setAttribute('aria-activedescendant', opcion.id);
                    opcion.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        function seleccionarResultadoInline(indice) {
            const evento = resultadosBusquedaInline[indice];
            if (!evento) return;
            const titulo = detectarTitulo(evento);
            searchInput.value = titulo;
            terminoBusqueda = titulo.toLowerCase();
            actualizarUIBuscador();
            actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
            ocultarResultadosInline();
            enfocarEventoEnCalendario(evento);
        }

        function renderizarResultadosInline() {
            if (!resultadosInline) return;
            const terminoVisible = String(searchInput.value || '').trim();
            resultadosInline.innerHTML = '';

            if (!terminoVisible) {
                ocultarResultadosInline();
                return;
            }

            resultadosBusquedaInline = obtenerResultadosBusquedaInline(terminoVisible);
            if (resultadosBusquedaInline.length === 0) {
                const li = document.createElement('li');
                li.className = 'evento-search-inline-empty';
                li.textContent = 'No hay eventos coincidentes.';
                resultadosInline.appendChild(li);
                resultadosInline.hidden = false;
                searchInput.setAttribute('aria-expanded', 'true');
                indiceActivoBusquedaInline = -1;
                return;
            }

            resultadosBusquedaInline.forEach(function(evento, indice) {
                const titulo = detectarTitulo(evento);
                const fecha = formatearFecha(detectarFecha(evento));
                const lugar = obtenerPropiedad(evento, 'lugar') || 'Sin lugar';

                const li = document.createElement('li');
                const boton = document.createElement('button');
                boton.type = 'button';
                boton.id = 'evento-search-inline-option-' + indice;
                boton.className = 'evento-search-result-option';
                boton.setAttribute('role', 'option');
                boton.setAttribute('aria-selected', 'false');
                boton.innerHTML = '<span class="evento-search-result-title"></span><span class="evento-search-result-meta"></span>';
                boton.querySelector('.evento-search-result-title').textContent = titulo;
                boton.querySelector('.evento-search-result-meta').textContent = (fecha || 'Fecha pendiente') + ' · ' + lugar;
                boton.addEventListener('mouseenter', function() {
                    actualizarIndiceActivoInline(indice);
                });
                boton.addEventListener('click', function() {
                    seleccionarResultadoInline(indice);
                });
                li.appendChild(boton);
                resultadosInline.appendChild(li);
            });

            resultadosInline.hidden = false;
            searchInput.setAttribute('aria-expanded', 'true');
            actualizarIndiceActivoInline(0);
        }

        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                terminoBusqueda = String(e.target.value || '').trim().toLowerCase();
                actualizarUIBuscador();
                actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
                renderizarResultadosInline();
            }, 220);
        });

        searchInput.addEventListener('focus', function() {
            if (timeoutBlurBusquedaInline) {
                clearTimeout(timeoutBlurBusquedaInline);
                timeoutBlurBusquedaInline = null;
            }
            if (String(searchInput.value || '').trim()) {
                renderizarResultadosInline();
            }
        });

        searchInput.addEventListener('blur', function() {
            timeoutBlurBusquedaInline = setTimeout(function() {
                ocultarResultadosInline();
            }, 140);
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                if (!resultadosInline || resultadosInline.hidden) {
                    renderizarResultadosInline();
                }
                if (resultadosBusquedaInline.length > 0) {
                    e.preventDefault();
                    actualizarIndiceActivoInline(indiceActivoBusquedaInline + 1);
                }
                return;
            }
            if (e.key === 'ArrowUp' && resultadosBusquedaInline.length > 0) {
                e.preventDefault();
                actualizarIndiceActivoInline(indiceActivoBusquedaInline - 1);
                return;
            }
            if (e.key === 'Enter' && indiceActivoBusquedaInline >= 0 && resultadosBusquedaInline.length > 0) {
                e.preventDefault();
                seleccionarResultadoInline(indiceActivoBusquedaInline);
                return;
            }
            if (e.key === 'Escape') {
                searchInput.value = '';
                terminoBusqueda = '';
                actualizarUIBuscador();
                actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
                ocultarResultadosInline();
            }
        });

        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            terminoBusqueda = '';
            actualizarUIBuscador();
            ocultarResultadosInline();
            searchInput.focus();
            actualizarCalendarioDinamico(obtenerEventosFiltradosActuales());
        });

        actualizarUIBuscador();
    }

    function guardarFiltrosChecksPublicos() {
        filtrosChecksPersistidos = {
            tipos: Array.from(document.querySelectorAll('#filtro-tipo-container input:checked')).map(function(input) { return input.value; }),
            lugar: Array.from(document.querySelectorAll('#filtro-lugar-container input:checked')).map(function(input) { return input.value; })
        };
        guardarJSONLocalStorage(CLAVE_FILTROS_CHECKS_PUBLIC, filtrosChecksPersistidos);
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
        const seleccionGuardada = new Set((filtrosChecksPersistidos[propiedad] || []).map(function(v) { return String(v).toLowerCase(); }));
        opcionesOrdenadas.forEach(function(opcion) {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.innerHTML = '<div><input type="checkbox" value="' + opcion + '" style="margin-right:8px;"><span>' + opcion + '</span></div>';
            const checkbox = label.querySelector('input');
            checkbox.checked = seleccionGuardada.has(String(opcion).toLowerCase());
            checkbox.addEventListener('change', function() {
                guardarFiltrosChecksPublicos();
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
            firstDay: 1,
            titleFormat: { year: 'numeric', month: 'short' },
            hiddenDays: diasAOcultarInicial,
            buttonText: {
                today: 'Hoy',
                dayGridMonth: 'Mes',
                listWeek: 'Semana',
                listMonth: 'Lista'
            },
            headerToolbar: {
                start: 'prev',
                center: 'title',
                end: 'next'
            },
            footerToolbar: {
                start: 'today',
                end: 'dayGridMonth,listWeek,listMonth'
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
        inicializarNavegacionSwipeCalendario(contenedorEl);
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
            const imagenResuelta = obtenerPropiedad(evento, 'resolvedimage');
            const descripcion = obtenerPropiedad(evento, 'descripcion');
            const inscripcionOnLine = obtenerPropiedad(evento, 'inscripciononline');
            const whatsapp = obtenerPropiedad(evento, 'whatsapp');
            const tiposArray = obtenerTiposArray(evento);
            const resolvedColor = obtenerPropiedad(evento, 'resolvedcolor') || obtenerPropiedad(evento, 'ResolvedColor') || '';
            const colores = obtenerColorFromResolvedColor(resolvedColor);
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
                    resolvedImage: imagenResuelta,
                    ResolvedColor: resolvedColor,
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
