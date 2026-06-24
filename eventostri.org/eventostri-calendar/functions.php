<?php
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

        wp_localize_script('eventostri-admin-v2-script', 'eventostriAdminV2Config', array(
            'exportCsvUrl' => esc_url_raw(wp_nonce_url(admin_url('admin-post.php?action=eventostri_export_csv'), 'eventostri_export_csv')),
        ));
    }

    if ($cargar_calendario_publico) {
        wp_enqueue_script(
            'eventostri-calendario-script',
            get_template_directory_uri() . '/assets/calendario/eventostri-calendario.js',
            array('fullcalendar'),
            $theme_version,
            true
        );

        wp_localize_script('eventostri-calendario-script', 'eventostriCalendarioConfig', array(
            'eventosUrl' => esc_url_raw(rest_url('eventostri/v1/eventos')),
        ));
    }
}
add_action('wp_enqueue_scripts', 'cargar_scripts_deportivos');

function eventostri_shortcode_calendario() {
    return '<div class="wrapper-eventos"><div class="search-container"><input type="text" id="evento-search-input" placeholder="Buscar eventos por nombre..." autocomplete="off" aria-label="Buscar eventos" aria-describedby="search-help"><button type="button" id="clear-search-btn" aria-label="Limpiar busqueda" style="display:none;">x</button><span id="search-help" class="sr-only">Escribe para filtrar eventos por nombre</span></div><div id="calendario" class="calendario-grid"></div><div class="filtros-container"><div class="filtro-grupo"><label>Filtrar por Tipo de Evento:</label><div id="filtro-tipo-container" class="checkbox-group-box"></div></div><div class="filtro-grupo"><label>Filtrar por Ubicaci&#243;n:</label><div id="filtro-lugar-container" class="checkbox-group-box"></div></div></div></div>';
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

function configurar_tema_deportivo() {
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

function eventostri_map_post_to_array($post_id) {
    $visible_meta = get_post_meta($post_id, 'VisibleEnCalendario', true);
    $visible_en_calendario = eventostri_normalizar_visible_en_calendario($visible_meta, true);

    return array(
        'Titulo' => (string) get_the_title($post_id),
        'Fecha_Hora' => (string) get_post_meta($post_id, 'Fecha_Hora', true),
        'Lugar' => (string) get_post_meta($post_id, 'Lugar', true),
        'Estado' => (string) get_post_meta($post_id, 'Estado', true),
        'Tipos' => (string) get_post_meta($post_id, 'Tipos', true),
        'Distancias' => (string) get_post_meta($post_id, 'Distancias', true),
        'Link' => (string) get_post_meta($post_id, 'Link', true),
        'Imagen' => (string) get_post_meta($post_id, 'Imagen', true),
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

function eventostri_rest_get_eventos() {
    $consulta = new WP_Query(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'meta_key' => 'Fecha_Hora',
        'orderby' => 'meta_value',
        'order' => 'ASC',
        'no_found_rows' => true
    ));

    $resultado = array();

    foreach ($consulta->posts as $post) {
        $resultado[] = eventostri_map_post_to_array($post->ID);
    }

    return rest_ensure_response($resultado);
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

            if (empty($evento['Titulo']) || empty($evento['Fecha_Hora'])) {
                continue;
            }

            $dedupe_key = strtolower(trim($evento['Titulo'])) . '|' . trim($evento['Fecha_Hora']);
            if (isset($vistos[$dedupe_key])) {
                $omitidos_duplicados++;
                continue;
            }
            $vistos[$dedupe_key] = true;

            $post_id = wp_insert_post(array(
                'post_type' => 'eventostri_evento',
                'post_status' => 'publish',
                'post_title' => $evento['Titulo']
            ), true);

            if (is_wp_error($post_id)) {
                continue;
            }

            $campos_meta = array(
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

            foreach ($campos_meta as $meta_key) {
                if ($meta_key === 'VisibleEnCalendario') {
                    update_post_meta($post_id, $meta_key, $evento[$meta_key] ? '1' : '0');
                } else {
                    update_post_meta($post_id, $meta_key, $evento[$meta_key]);
                }
            }

            $insertados++;
        }

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

function eventostri_registrar_rest_routes() {
    register_rest_route('eventostri/v1', '/eventos', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'eventostri_rest_get_eventos',
        'permission_callback' => '__return_true'
    ));

    register_rest_route('eventostri/v1', '/eventos/sync', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'eventostri_rest_sync_eventos',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        }
    ));

    register_rest_route('eventostri/v1', '/auth-status', array(
        'methods' => array(WP_REST_Server::READABLE, WP_REST_Server::CREATABLE),
        'callback' => 'eventostri_rest_auth_status',
        'permission_callback' => '__return_true'
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