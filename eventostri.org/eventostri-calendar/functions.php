<?php
require_once get_template_directory() . '/admin/eventostri-settings.php';
require_once get_template_directory() . '/inc/eventostri-favorites.php';
require_once get_template_directory() . '/inc/eventostri-calendar-integrations.php';
require_once get_template_directory() . '/inc/eventostri-notifications.php';
require_once get_template_directory() . '/inc/eventostri-performance.php';

function eventostri_debe_cargar_admin_v2() {
    if (is_page(array('administrar-calendario', 'administrar-calendario-v2'))) {
        return true;
    }

    if (!is_singular()) {
        return false;
    }

    global $post;
    if (!$post || !isset($post->post_content)) {
        return false;
    }

    return has_shortcode($post->post_content, 'eventostri_admin_v2');
}

function eventostri_debe_cargar_calendario_publico() {
    if (is_page('calendario')) {
        return true;
    }

    if (!is_singular()) {
        return false;
    }

    global $post;
    if (!$post || !isset($post->post_content)) {
        return false;
    }

    return has_shortcode($post->post_content, 'eventostri_calendario');
}

function cargar_scripts_deportivos() {
    $theme_version = wp_get_theme()->get('Version');

    // Cargar siempre la hoja de estilos del tema
    wp_enqueue_style(
        'tema-deportivo-style',
        get_stylesheet_uri(),
        array(),
        $theme_version
    );

    $cargar_admin_v2 = eventostri_debe_cargar_admin_v2();
    $cargar_calendario_publico = eventostri_debe_cargar_calendario_publico();
    $cargar_fullcalendar = $cargar_calendario_publico || $cargar_admin_v2;

    // Cargar FullCalendar para calendario publico y admin v2.
    if ($cargar_fullcalendar) {
        wp_enqueue_style(
            'fullcalendar-css',
            'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css',
            array(),
            null
        );

        wp_enqueue_script(
            'fullcalendar',
            'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js',
            array(),
            null,
            true
        );
    }

    if ($cargar_admin_v2) {
        wp_enqueue_style(
            'eventostri-admin-v2-style',
            get_template_directory_uri() . '/assets/admin-v2/admin-eventTri-v2.css',
            array('tema-deportivo-style', 'fullcalendar-css'),
            $theme_version
        );

        wp_enqueue_script(
            'eventostri-admin-v2-script',
            get_template_directory_uri() . '/assets/admin-v2/admin-eventTri-v2.js',
            array('fullcalendar'),
            $theme_version,
            true
        );

        wp_localize_script(
            'eventostri-admin-v2-script',
            'eventostriAdminV2Config',
            eventostri_calendar_get_admin_script_config()
        );
    }

    if ($cargar_calendario_publico) {
        wp_enqueue_script(
            'eventostri-calendario-script',
            get_template_directory_uri() . '/assets/calendario/eventostri-calendario.js',
            array('fullcalendar'),
            $theme_version,
            true
        );

        wp_localize_script(
            'eventostri-calendario-script',
            'eventostriCalendarioConfig',
            eventostri_calendar_get_public_script_config()
        );
    }
}
add_action('wp_enqueue_scripts', 'cargar_scripts_deportivos');

function eventostri_shortcode_calendario() {
    $placeholder = esc_attr__('Buscar eventos por nombre...', 'eventostri-calendar');
    $aria_label = esc_attr__('Buscar eventos', 'eventostri-calendar');
    $help = esc_html__('Escribe para filtrar eventos por nombre. Doble clic para abrir busqueda avanzada.', 'eventostri-calendar');

    return '<div class="wrapper-eventos"><div class="search-container"><div class="search-input-wrap"><input type="text" id="evento-search-input" placeholder="' . $placeholder . '" autocomplete="off" aria-label="' . $aria_label . '" aria-describedby="search-help" aria-autocomplete="list" aria-expanded="false" aria-controls="evento-search-inline-results"><button type="button" id="clear-search-btn" aria-label="Limpiar busqueda" style="display:none;">&times;</button><ul id="evento-search-inline-results" class="evento-search-inline-results" role="listbox" aria-label="Resultados de busqueda en linea" hidden></ul></div><span id="search-help" class="sr-only">' . $help . '</span></div><div id="calendario" class="calendario-grid"></div><div class="filtros-container"><div class="filtro-grupo"><label>Filtrar por Tipo de Evento:</label><div id="filtro-tipo-container" class="checkbox-group-box"></div></div><div class="filtro-grupo"><label>Filtrar por Ubicaci&#243;n:</label><div id="filtro-lugar-container" class="checkbox-group-box"></div></div></div></div>';
}
add_shortcode('eventostri_calendario', 'eventostri_shortcode_calendario');

function eventostri_shortcode_admin_v2() {
    $template = get_template_directory() . '/assets/admin-v2/admin-eventTri-v2-template.php';
    if (!file_exists($template)) {
        return '<p>No se encontro la plantilla del admin v2.</p>';
    }

    ob_start();
    include $template;
    return ob_get_clean();
}
add_shortcode('eventostri_admin_v2', 'eventostri_shortcode_admin_v2');

function eventostri_shortcode_branding_image() {
    // Determine if this is the admin calendar page
    $is_admin_page = false;
    if (is_page(array('administrar-calendario', 'administrar-calendario-v2'))) {
        $is_admin_page = true;
    } elseif (is_singular()) {
        global $post;
        if ($post && isset($post->post_content) && has_shortcode($post->post_content, 'eventostri_admin_v2')) {
            $is_admin_page = true;
        }
    }
    
    $logo_url = $is_admin_page 
        ? eventostri_calendar_get_header_image('admin')
        : eventostri_calendar_get_header_image('public');
    
    if (!$logo_url) {
        return '';
    }

    $site_name = get_bloginfo('name');
    $alt = $site_name ? $site_name : 'EventosTri';

    return '<div class="eventostri-header-branding"><img src="' . esc_url($logo_url) . '" alt="' . esc_attr($alt) . '" decoding="async"></div>';
}
add_shortcode('eventostri_branding_image', 'eventostri_shortcode_branding_image');

function configurar_tema_deportivo() {
    load_theme_textdomain('eventostri-calendar', get_template_directory() . '/languages');
    add_theme_support('wp-block-styles');
    add_theme_support('align-wide');
    add_theme_support('responsive-embeds');
    add_theme_support('editor-styles');
    add_editor_style('editor-style.css');

    add_theme_support('custom-logo', array(
        'height'               => 100,
        'width'                => 100,
        'flex-height'          => true,
        'flex-width'           => true,
    ));
}
add_action('after_setup_theme', 'configurar_tema_deportivo');

function eventostri_registrar_cpt_eventos() {
    register_post_type('eventostri_evento', array(
        'labels' => array(
            'name' => 'Eventos TRI',
            'singular_name' => 'Evento TRI'
        ),
        'public' => false,
        'show_ui' => true,
        'show_in_rest' => false,
        'supports' => array('title'),
        'menu_icon' => 'dashicons-calendar-alt'
    ));
}
add_action('init', 'eventostri_registrar_cpt_eventos');

function eventostri_evento_meta_keys() {
    return array(
        'Fecha_Hora',
        'Lugar',
        'Estado',
        'Tipos',
        'Distancias',
        'Link',
        'Imagen',
        'Descripcion',
        'Whatsapp',
        'InscripcionOnLine',
        'Organizador',
        'VisibleEnCalendario'
    );
}

function eventostri_map_post_to_array($post_id) {
    $visible_meta = get_post_meta($post_id, 'VisibleEnCalendario', true);
    $visible_en_calendario = eventostri_normalizar_visible_en_calendario($visible_meta, true);
    $imagen = (string) get_post_meta($post_id, 'Imagen', true);
    $tipos = (string) get_post_meta($post_id, 'Tipos', true);

    return array(
        'id' => (int) $post_id,
        'Titulo' => (string) get_the_title($post_id),
        'Fecha_Hora' => (string) get_post_meta($post_id, 'Fecha_Hora', true),
        'Lugar' => (string) get_post_meta($post_id, 'Lugar', true),
        'Estado' => (string) get_post_meta($post_id, 'Estado', true),
        'Tipos' => $tipos,
        'Distancias' => (string) get_post_meta($post_id, 'Distancias', true),
        'Link' => (string) get_post_meta($post_id, 'Link', true),
        'Imagen' => $imagen,
        'ResolvedImage' => eventostri_calendar_resolve_event_image_url($imagen),
        'ResolvedColor' => eventostri_get_event_color($tipos),
        'Descripcion' => (string) get_post_meta($post_id, 'Descripcion', true),
        'Whatsapp' => (string) get_post_meta($post_id, 'Whatsapp', true),
        'InscripcionOnLine' => (string) get_post_meta($post_id, 'InscripcionOnLine', true),
        'Organizador' => (string) get_post_meta($post_id, 'Organizador', true),
        'VisibleEnCalendario' => $visible_en_calendario
    );
}

function eventostri_normalizar_visible_en_calendario($valor, $fallback) {
    if ($valor === null || $valor === '') {
        return (bool) $fallback;
    }

    if (is_bool($valor)) {
        return $valor;
    }

    if (is_numeric($valor)) {
        return ((int) $valor) === 1;
    }

    $texto = strtolower(trim((string) $valor));
    if ($texto === '') {
        return (bool) $fallback;
    }

    if (in_array($texto, array('1', 'true', 'yes', 'si', 'on'), true)) {
        return true;
    }

    if (in_array($texto, array('0', 'false', 'no', 'off'), true)) {
        return false;
    }

    return (bool) $fallback;
}

function eventostri_get_event_color($tipos_string) {
    $tipo_colors = eventostri_calendar_get_tipo_colors();
    $tipos = array_filter(array_map('trim', explode(',', (string) $tipos_string)));
    
    foreach ($tipos as $tipo) {
        $tipo_lower = strtolower($tipo);
        foreach ($tipo_colors['tipos'] as $configured_tipo) {
            if (strtolower($configured_tipo['name']) === $tipo_lower) {
                $color_value = trim($configured_tipo['color']);
                if ($color_value !== '') {
                    return $color_value;
                }
            }
        }
    }
    
    return $tipo_colors['default_color'];
}

function eventostri_normalizar_evento($ev) {
    if (!is_array($ev)) {
        return array();
    }

    $visible_en_calendario = array_key_exists('VisibleEnCalendario', $ev)
        ? eventostri_normalizar_visible_en_calendario($ev['VisibleEnCalendario'], false)
        : false;

    return array(
        'Titulo' => sanitize_text_field((string) ($ev['Titulo'] ?? 'Evento deportivo')),
        'Fecha_Hora' => sanitize_text_field((string) ($ev['Fecha_Hora'] ?? '')),
        'Lugar' => sanitize_text_field((string) ($ev['Lugar'] ?? '')),
        'Estado' => sanitize_text_field((string) ($ev['Estado'] ?? 'Programado')),
        'Tipos' => sanitize_text_field((string) ($ev['Tipos'] ?? '')),
        'Distancias' => sanitize_text_field((string) ($ev['Distancias'] ?? '')),
        'Link' => esc_url_raw((string) ($ev['Link'] ?? '')),
        'Imagen' => esc_url_raw((string) ($ev['Imagen'] ?? '')),
        'Descripcion' => sanitize_textarea_field((string) ($ev['Descripcion'] ?? '')),
        'Whatsapp' => sanitize_text_field((string) ($ev['Whatsapp'] ?? '')),
        'InscripcionOnLine' => esc_url_raw((string) ($ev['InscripcionOnLine'] ?? '')),
        'Organizador' => sanitize_text_field((string) ($ev['Organizador'] ?? '')),
        'VisibleEnCalendario' => $visible_en_calendario
    );
}

function eventostri_validar_evento_normalizado($evento) {
    if (empty($evento['Titulo']) || empty($evento['Fecha_Hora'])) {
        return new WP_Error(
            'eventostri_evento_invalido',
            'Los campos Titulo y Fecha_Hora son obligatorios.',
            array('status' => 400)
        );
    }

    return true;
}

function eventostri_extraer_evento_desde_request(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        return new WP_Error(
            'eventostri_payload_invalido',
            'El cuerpo debe ser un objeto JSON de evento.',
            array('status' => 400)
        );
    }

    $evento = eventostri_normalizar_evento($payload);
    $validacion = eventostri_validar_evento_normalizado($evento);
    if (is_wp_error($validacion)) {
        return $validacion;
    }

    return $evento;
}

function eventostri_extraer_lista_eventos_desde_request(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (is_array($payload) && array_key_exists('eventos', $payload)) {
        $payload = $payload['eventos'];
    }

    if (!is_array($payload)) {
        return new WP_Error(
            'eventostri_payload_invalido',
            'El cuerpo debe incluir un arreglo de eventos.',
            array('status' => 400)
        );
    }

    return $payload;
}

function eventostri_guardar_meta_evento($post_id, $evento) {
    foreach (eventostri_evento_meta_keys() as $meta_key) {
        if ($meta_key === 'VisibleEnCalendario') {
            update_post_meta($post_id, $meta_key, $evento[$meta_key] ? '1' : '0');
            continue;
        }

        update_post_meta($post_id, $meta_key, $evento[$meta_key]);
    }

    eventostri_calendar_update_event_derived_meta((int) $post_id, $evento['Fecha_Hora']);
}

function eventostri_guardar_evento_post($evento, $post_id = 0, $invalidate_public_events_cache = true) {
    $post_data = array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'post_title' => $evento['Titulo']
    );

    if ($post_id > 0) {
        $post_data['ID'] = $post_id;
        $saved_id = wp_update_post($post_data, true);
    } else {
        $saved_id = wp_insert_post($post_data, true);
    }

    if (is_wp_error($saved_id)) {
        return $saved_id;
    }

    eventostri_guardar_meta_evento((int) $saved_id, $evento);

    if ($invalidate_public_events_cache) {
        eventostri_calendar_invalidate_public_events_cache();
    }

    return (int) $saved_id;
}

function eventostri_obtener_post_evento($post_id) {
    $post = get_post((int) $post_id);
    if (!$post || $post->post_type !== 'eventostri_evento') {
        return new WP_Error(
            'eventostri_evento_no_encontrado',
            'No se encontro el evento solicitado.',
            array('status' => 404)
        );
    }

    return $post;
}

function eventostri_evento_dedupe_key($titulo, $fecha_hora, $lugar) {
    return strtolower(trim((string) $titulo)) . '|' . trim((string) $fecha_hora) . '|' . strtolower(trim((string) $lugar));
}

function eventostri_obtener_indice_eventos_existentes() {
    $consulta = new WP_Query(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true
    ));

    $indice = array();
    foreach ($consulta->posts as $post_id) {
        $indice[eventostri_evento_dedupe_key(
            get_the_title($post_id),
            get_post_meta($post_id, 'Fecha_Hora', true),
            get_post_meta($post_id, 'Lugar', true)
        )] = (int) $post_id;
    }

    return $indice;
}

function eventostri_fecha_evento_es_pasada($fecha_hora) {
    $solo_fecha = substr(trim((string) $fecha_hora), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $solo_fecha)) {
        return false;
    }

    return $solo_fecha < wp_date('Y-m-d');
}

function eventostri_rest_get_eventos(WP_REST_Request $request) {
    $context = eventostri_calendar_get_request_context($request);

    if ($context === 'public') {
        $envelope = eventostri_calendar_get_public_events_cache_envelope();
        $resultado = is_array($envelope['events']) ? $envelope['events'] : array();
        $etag = isset($envelope['etag']) ? (string) $envelope['etag'] : '';
        $last_changed = isset($envelope['last_changed']) ? (int) $envelope['last_changed'] : time();

        if ($etag !== '' && eventostri_calendar_public_events_request_not_modified($request, $etag, $last_changed)) {
            $not_modified = new WP_REST_Response(null, 304);
            eventostri_calendar_apply_public_events_response_headers($not_modified, $etag, $last_changed);
            return $not_modified;
        }

        $response = rest_ensure_response($resultado);
        eventostri_calendar_apply_public_events_response_headers($response, $etag, $last_changed);
        return $response;
    }

    return rest_ensure_response(eventostri_calendar_get_admin_events_payload());
}

function eventostri_generar_csv_eventos() {
    $consulta = new WP_Query(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'meta_key' => 'Fecha_Hora',
        'orderby' => 'meta_value',
        'order' => 'ASC',
        'no_found_rows' => true
    ));

    $salida = fopen('php://temp', 'r+');
    fputcsv($salida, array('Titulo', 'Fecha_Hora', 'Lugar', 'Estado', 'Tipos', 'Distancias', 'Link', 'Imagen', 'Descripcion', 'Whatsapp', 'InscripcionOnLine', 'Organizador', 'VisibleEnCalendario'));

    foreach ($consulta->posts as $post) {
        $evento = eventostri_map_post_to_array($post->ID);
        fputcsv($salida, array(
            $evento['Titulo'],
            $evento['Fecha_Hora'],
            $evento['Lugar'],
            $evento['Estado'],
            $evento['Tipos'],
            $evento['Distancias'],
            $evento['Link'],
            $evento['Imagen'],
            $evento['Descripcion'],
            $evento['Whatsapp'],
            $evento['InscripcionOnLine'],
            $evento['Organizador'],
            $evento['VisibleEnCalendario'] ? '1' : '0'
        ));
    }

    rewind($salida);
    $csv = stream_get_contents($salida);
    fclose($salida);

    return $csv;
}

function eventostri_descargar_csv_eventos() {
    if (!current_user_can('edit_posts')) {
        wp_die('No autorizado para exportar CSV.', 'Acceso denegado', array('response' => 403));
    }

    check_admin_referer('eventostri_export_csv');

    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="eventostri-eventos.csv"');
    header('Pragma: no-cache');
    header('Expires: 0');

    echo "\xEF\xBB\xBF" . eventostri_generar_csv_eventos();
    exit;
}
add_action('admin_post_eventostri_export_csv', 'eventostri_descargar_csv_eventos');

function eventostri_rest_create_evento(WP_REST_Request $request) {
    $evento = eventostri_extraer_evento_desde_request($request);
    if (is_wp_error($evento)) {
        return $evento;
    }

    $post_id = eventostri_guardar_evento_post($evento);
    if (is_wp_error($post_id)) {
        return $post_id;
    }

    return rest_ensure_response(array(
        'ok' => true,
        'evento' => eventostri_map_post_to_array($post_id)
    ));
}

function eventostri_rest_update_evento(WP_REST_Request $request) {
    $post_id = (int) $request['id'];
    $post = eventostri_obtener_post_evento($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $evento = eventostri_extraer_evento_desde_request($request);
    if (is_wp_error($evento)) {
        return $evento;
    }

    $saved_id = eventostri_guardar_evento_post($evento, $post->ID);
    if (is_wp_error($saved_id)) {
        return $saved_id;
    }

    return rest_ensure_response(array(
        'ok' => true,
        'evento' => eventostri_map_post_to_array($saved_id)
    ));
}

function eventostri_rest_delete_evento(WP_REST_Request $request) {
    $post_id = (int) $request['id'];
    $post = eventostri_obtener_post_evento($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $deleted = wp_delete_post($post->ID, true);
    if (!$deleted) {
        return new WP_Error(
            'eventostri_evento_no_eliminado',
            'No se pudo eliminar el evento solicitado.',
            array('status' => 500)
        );
    }

    eventostri_calendar_invalidate_public_events_cache();

    return rest_ensure_response(array(
        'ok' => true,
        'deleted_id' => (int) $post_id
    ));
}

function eventostri_rest_import_eventos(WP_REST_Request $request) {
    $items = eventostri_extraer_lista_eventos_desde_request($request);
    if (is_wp_error($items)) {
        return $items;
    }

    $existentes = eventostri_obtener_indice_eventos_existentes();
    $vistos = array();
    $insertados = 0;
    $omitidos_duplicados = 0;
    $eventos_creados = array();

    foreach ($items as $item) {
        $evento = eventostri_normalizar_evento($item);
        $validacion = eventostri_validar_evento_normalizado($evento);
        if (is_wp_error($validacion)) {
            continue;
        }

        $dedupe_key = eventostri_evento_dedupe_key($evento['Titulo'], $evento['Fecha_Hora'], $evento['Lugar']);
        if (isset($vistos[$dedupe_key]) || isset($existentes[$dedupe_key])) {
            $omitidos_duplicados++;
            continue;
        }
        $vistos[$dedupe_key] = true;

        $post_id = eventostri_guardar_evento_post($evento, 0, false);
        if (is_wp_error($post_id)) {
            continue;
        }

        $existentes[$dedupe_key] = $post_id;
        $eventos_creados[] = eventostri_map_post_to_array($post_id);
        $insertados++;
    }

    if ($insertados > 0) {
        eventostri_calendar_invalidate_public_events_cache();
    }

    return rest_ensure_response(array(
        'ok' => true,
        'insertados' => $insertados,
        'omitidos_duplicados' => $omitidos_duplicados,
        'eventos' => $eventos_creados
    ));
}

function eventostri_rest_delete_past_eventos() {
    $consulta = new WP_Query(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true
    ));

    $deleted_ids = array();
    foreach ($consulta->posts as $post_id) {
        $fecha_hora = get_post_meta($post_id, 'Fecha_Hora', true);
        if (!eventostri_fecha_evento_es_pasada($fecha_hora)) {
            continue;
        }

        $deleted = wp_delete_post((int) $post_id, true);
        if ($deleted) {
            $deleted_ids[] = (int) $post_id;
        }
    }

    if (!empty($deleted_ids)) {
        eventostri_calendar_invalidate_public_events_cache();
    }

    return rest_ensure_response(array(
        'ok' => true,
        'deleted_ids' => $deleted_ids,
        'deleted_count' => count($deleted_ids)
    ));
}

function eventostri_rest_sync_eventos(WP_REST_Request $request) {
    $lock_key = 'eventostri_sync_lock';
    $lock_ttl_seconds = 30;

    if (!add_option($lock_key, (string) time(), '', false)) {
        return new WP_Error(
            'eventostri_sync_en_curso',
            'Ya hay una sincronizacion en curso. Intenta de nuevo en unos segundos.',
            array('status' => 409)
        );
    }

    $items = $request->get_json_params();

    if (!is_array($items)) {
        delete_option($lock_key);
        return new WP_Error(
            'eventostri_payload_invalido',
            'El cuerpo debe ser un arreglo de eventos.',
            array('status' => 400)
        );
    }

    try {
        $existentes = get_posts(array(
            'post_type' => 'eventostri_evento',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'no_found_rows' => true
        ));

        foreach ($existentes as $post_id) {
            wp_delete_post($post_id, true);
        }

        $insertados = 0;
        $omitidos_duplicados = 0;
        $vistos = array();

        foreach ($items as $item) {
            $evento = eventostri_normalizar_evento($item);
            $validacion = eventostri_validar_evento_normalizado($evento);
            if (is_wp_error($validacion)) {
                continue;
            }

            $dedupe_key = eventostri_evento_dedupe_key($evento['Titulo'], $evento['Fecha_Hora'], $evento['Lugar']);
            if (isset($vistos[$dedupe_key])) {
                $omitidos_duplicados++;
                continue;
            }
            $vistos[$dedupe_key] = true;

            $post_id = eventostri_guardar_evento_post($evento, 0, false);
            if (is_wp_error($post_id)) {
                continue;
            }

            $insertados++;
        }

        eventostri_calendar_invalidate_public_events_cache();

        return rest_ensure_response(array(
            'ok' => true,
            'insertados' => $insertados,
            'omitidos_duplicados' => $omitidos_duplicados
        ));
    } finally {
        $lock_timestamp = (int) get_option($lock_key, 0);
        if ($lock_timestamp && ((time() - $lock_timestamp) > $lock_ttl_seconds)) {
            delete_option($lock_key);
        } else {
            delete_option($lock_key);
        }
    }
}

function eventostri_rest_auth_status() {
    nocache_headers();

    $allow_cookie_bootstrap = defined('EVENTOSTRI_REST_COOKIE_BOOTSTRAP')
        ? (bool) EVENTOSTRI_REST_COOKIE_BOOTSTRAP
        : true;
    $include_debug = defined('EVENTOSTRI_AUTH_STATUS_DEBUG')
        ? (bool) EVENTOSTRI_AUTH_STATUS_DEBUG
        : false;

    // REST requests without X-WP-Nonce are treated as anonymous by core.
    // Bootstrap user from the logged_in cookie so this endpoint can issue nonce.
    if ($allow_cookie_bootstrap && !is_user_logged_in()) {
        $logged_in_cookie_name = 'wordpress_logged_in_' . COOKIEHASH;
        if (!empty($_COOKIE[$logged_in_cookie_name])) {
            $validated_user_id = wp_validate_auth_cookie($_COOKIE[$logged_in_cookie_name], 'logged_in');
            if ($validated_user_id) {
                wp_set_current_user((int) $validated_user_id);
            }
        }
    }

    $logged_in = is_user_logged_in();
    $can_sync = current_user_can('edit_posts');
    $user = wp_get_current_user();

    $response = array(
        'ok' => true,
        'logged_in' => (bool) $logged_in,
        'can_sync' => (bool) $can_sync,
        'nonce' => $logged_in ? wp_create_nonce('wp_rest') : '',
        'user' => $logged_in ? array(
            'id' => (int) $user->ID,
            'name' => (string) $user->display_name,
            'login' => (string) $user->user_login
        ) : null
    );

    if ($include_debug) {
        $debug_cookies = array();
        foreach ($_COOKIE as $name => $value) {
            if (strpos($name, 'wordpress') !== false) {
                $debug_cookies[] = $name;
            }
        }
        $response['debug'] = array(
            'wordpress_cookies_seen' => $debug_cookies,
            'current_user_id' => (int) get_current_user_id(),
            'wp_user_id' => (int) $user->ID,
            'session_id' => session_id(),
            'cookie_hash' => COOKIEHASH,
            'nonce_header_present' => !empty($_SERVER['HTTP_X_WP_NONCE'])
        );
    }

    return rest_ensure_response($response);
}

function eventostri_rest_eventos_permission_check() {
    return current_user_can('edit_posts');
}

function eventostri_registrar_rest_routes() {
    register_rest_route('eventostri/v1', '/eventos', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'eventostri_rest_get_eventos',
            'permission_callback' => '__return_true'
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'eventostri_rest_create_evento',
            'permission_callback' => 'eventostri_rest_eventos_permission_check'
        )
    ));

    register_rest_route('eventostri/v1', '/eventos/(?P<id>\d+)', array(
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'eventostri_rest_update_evento',
            'permission_callback' => 'eventostri_rest_eventos_permission_check'
        ),
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'eventostri_rest_delete_evento',
            'permission_callback' => 'eventostri_rest_eventos_permission_check'
        )
    ));

    register_rest_route('eventostri/v1', '/eventos/import', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_import_eventos',
        'permission_callback' => 'eventostri_rest_eventos_permission_check'
    ));

    register_rest_route('eventostri/v1', '/eventos/delete-past', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_delete_past_eventos',
        'permission_callback' => 'eventostri_rest_eventos_permission_check'
    ));

    register_rest_route('eventostri/v1', '/eventos/sync', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_sync_eventos',
        // Deprecated compatibility endpoint. Prefer single-item CRUD and explicit batch routes.
        'permission_callback' => 'eventostri_rest_eventos_permission_check'
    ));

    register_rest_route('eventostri/v1', '/auth-status', array(
        'methods' => array(WP_REST_Server::READABLE, WP_REST_Server::CREATABLE),
        'callback' => 'eventostri_rest_auth_status',
        'permission_callback' => '__return_true'
    ));

    register_rest_route('eventostri/v1', '/favorites', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'eventostri_rest_get_favorites',
        'permission_callback' => 'eventostri_rest_favorites_permission_check'
    ));

    register_rest_route('eventostri/v1', '/favorites/toggle', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_toggle_favorite',
        'permission_callback' => 'eventostri_rest_favorites_permission_check'
    ));

    register_rest_route('eventostri/v1', '/favorites/merge', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_merge_favorites',
        'permission_callback' => 'eventostri_rest_favorites_permission_check'
    ));
}
add_action('rest_api_init', 'eventostri_registrar_rest_routes');

function eventostri_imprimir_rest_nonce_meta() {
    if (!is_user_logged_in()) {
        return;
    }

    echo '<meta name="wp-rest-nonce" content="' . esc_attr(wp_create_nonce('wp_rest')) . '">';
}
add_action('wp_head', 'eventostri_imprimir_rest_nonce_meta');
add_action('admin_head', 'eventostri_imprimir_rest_nonce_meta');
