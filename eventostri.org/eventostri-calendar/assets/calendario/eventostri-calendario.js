(function() {
    if (window.__eventostriCalendarioPublicoInicializado) {
        return;
    }
    window.__eventostriCalendarioPublicoInicializado = true;

    let datosEventos = [];
    let calendarioInstancia = null;
    let rangoVisibleMes = null;
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
            '<span class="evento-modal-label">Lugar</span>',
            '<p class="evento-modal-place"></p>',
            '</div>',
            '<div class="evento-modal-meta">',
            '<span class="evento-modal-label">Fecha y hora</span>',
            '<p class="evento-modal-date"></p>',
            '</div>',
            '<div class="evento-modal-meta">',
            '<span class="evento-modal-label">Distancias</span>',
            '<div class="evento-modal-distances"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-link-block">',
            '<span class="evento-modal-label">Enlace</span>',
            '<div class="evento-modal-link-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-inscripcion-block">',
            '<span class="evento-modal-label">InscripcionesOnLine</span>',
            '<div class="evento-modal-inscripcion-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-whatsapp-block">',
            '<span class="evento-modal-label">Whatsapp</span>',
            '<div class="evento-modal-whatsapp-wrap"></div>',
            '</div>',
            '<div class="evento-modal-meta evento-modal-description-block">',
            '<span class="evento-modal-label">Descripcion</span>',
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

        const datos = evento.extendedProps || {};
        const url = (datos.link || '').trim();
        const inscripcionUrl = (datos.inscripcionesonline || datos.inscripciononline || '').trim();
        const whatsappTexto = (datos.whatsapp || '').trim();
        const imagenUrl = (datos.imagen || '').trim();
        const tituloTexto = datos.titulo || evento.title || 'Evento deportivo';
        const lugarTexto = datos.lugar || 'Sin lugar especificado';
        const fechaTexto = datos.fechaFormateada || formatearFecha(evento.start || datos.fecha_hora);
        const distanciasTexto = datos.distancias || '';
        const descripcionTexto = datos.descripcion || '';

        titulo.textContent = tituloTexto;
        lugar.textContent = lugarTexto;
        fecha.textContent = fechaTexto;
        descripcion.textContent = descripcionTexto || 'No hay descripcion disponible.';

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
            if (inscripcionBlock) {
                inscripcionBlock.style.display = '';
            }
        } else if (inscripcionBlock) {
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

            if (whatsappBlock) {
                whatsappBlock.style.display = '';
            }
        } else if (whatsappBlock) {
            whatsappBlock.style.display = 'none';
        }

        modal.classList.add('is-open');
    }

    function ejecutarInicializacion() {
        const contenedorTipo = document.getElementById('filtro-tipo-container');
        const contenedorLugar = document.getElementById('filtro-lugar-container');
        const contenedorCalendario = document.getElementById('calendario');

        if (!contenedorTipo || !contenedorLugar || !contenedorCalendario) {
            return false;
        }

        if (contenedorCalendario.dataset.fcInicializado === 'true') {
            return true;
        }

        contenedorCalendario.dataset.fcInicializado = 'true';

        let wrapper = document.querySelector('.wrapper-eventos');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'wrapper-eventos';
            if (contenedorCalendario.parentNode) {
                contenedorCalendario.parentNode.insertBefore(wrapper, contenedorCalendario);
            }
        }

        if (wrapper !== contenedorCalendario.parentNode) {
            wrapper.appendChild(contenedorCalendario);
        }

        const contenedorFiltros = document.querySelector('.filtros-container');
        if (contenedorFiltros && !wrapper.contains(contenedorFiltros)) {
            wrapper.appendChild(contenedorFiltros);
        }

        if (wrapper.firstChild !== contenedorCalendario) {
            wrapper.insertBefore(contenedorCalendario, wrapper.firstChild);
        }

        if (contenedorFiltros && wrapper.lastChild !== contenedorFiltros) {
            wrapper.appendChild(contenedorFiltros);
        }

        generarCheckboxes(datosEventos, 'tipos', 'filtro-tipo-container');
        generarCheckboxes(datosEventos, 'lugar', 'filtro-lugar-container');
        inicializarGridMensual(datosEventos);
        return true;
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
                const tiposCheck = Array.from(document.querySelectorAll('#filtro-tipo-container input:checked')).map(function(input) {
                    return input.value;
                });
                const lugaresCheck = Array.from(document.querySelectorAll('#filtro-lugar-container input:checked')).map(function(input) {
                    return input.value;
                });

                const filtrados = datosEventos.filter(function(evento) {
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

                actualizarCalendarioDinamico(filtrados);
            });

            contenedor.appendChild(label);
        });
    }

    function calcularDiasAOcultar(eventosFiltrados, rangoVisible) {
        const diasSemanaOcultables = [1, 2, 3, 4, 5];
        const diasConEventos = new Set();

        eventosFiltrados.forEach(function(evento) {
            const fechaEvento = detectarFecha(evento);
            if (!fechaEvento) {
                return;
            }

            const fechaPlana = String(fechaEvento).split(/[T ]/)[0];
            const partes = fechaPlana.split('-');
            if (partes.length !== 3) {
                return;
            }

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
                if (title) {
                    title.style.color = colores.textColor;
                }
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
        const tiposCheck = Array.from(document.querySelectorAll('#filtro-tipo-container input:checked')).map(function(input) {
            return input.value;
        });
        const lugaresCheck = Array.from(document.querySelectorAll('#filtro-lugar-container input:checked')).map(function(input) {
            return input.value;
        });

        return datosEventos.filter(function(evento) {
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

    function mapearEventos(eventos) {
        return eventos.map(function(evento) {
            const titulo = detectarTitulo(evento);
            const fecha = detectarFecha(evento);
            const link = obtenerPropiedad(evento, 'link');
            const lugar = obtenerPropiedad(evento, 'lugar');
            const distancias = obtenerPropiedad(evento, 'distancias');
            const imagen = obtenerPropiedad(evento, 'imagen');
            const descripcion = obtenerPropiedad(evento, 'descripcion');
            const inscripcionOnLine = obtenerPropiedad(evento, 'inscripciononline');
            const whatsapp = obtenerPropiedad(evento, 'whatsapp');
            const tiposArray = obtenerTiposArray(evento);
            const colores = obtenerColorPorTipos(tiposArray);

            return {
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
                    distancias: distancias,
                    imagen: imagen,
                    descripcion: descripcion,
                    inscripciononline: inscripcionOnLine,
                    inscripcionesonline: inscripcionOnLine,
                    whatsapp: whatsapp,
                    link: link,
                    fecha_hora: fecha,
                    fechaFormateada: formatearFecha(fecha),
                    tipos: tiposArray
                }
            };
        }).filter(function(evento) {
            return evento.start !== null;
        });
    }

    function actualizarCalendarioDinamico(eventosFiltrados) {
        if (!calendarioInstancia) return;

        aplicarDiasOcultosPorMes(eventosFiltrados);
        calendarioInstancia.removeAllEvents();
        calendarioInstancia.addEventSource(mapearEventos(eventosFiltrados));
        forzarRecalculoTamanoCalendario();
    }
})();