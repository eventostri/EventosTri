<?php
function cargar_scripts_deportivos() {
    // Cargar siempre la hoja de estilos del tema
    wp_enqueue_style(
        'tema-deportivo-style',
        get_stylesheet_uri(),
        array(),
        wp_get_theme()->get('Version')
    );

    // Solo cargar FullCalendar en la página que necesites (ajusta 'calendario' por el slug de tu página)
    if ( is_page('calendario') ) {
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
}
add_action('wp_enqueue_scripts', 'cargar_scripts_deportivos');

function configurar_tema_deportivo() {
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
    return array(
        'Titulo' => (string) get_the_title($post_id),
        'Fecha_Hora' => (string) get_post_meta($post_id, 'Fecha_Hora', true),
        'Lugar' => (string) get_post_meta($post_id, 'Lugar', true),
        'Estado' => (string) get_post_meta($post_id, 'Estado', true),
        'Tipos' => (string) get_post_meta($post_id, 'Tipos', true),
        'Distancias' => (string) get_post_meta($post_id, 'Distancias', true),
        'Link' => (string) get_post_meta($post_id, 'Link', true),
        'Imagen' => (string) get_post_meta($post_id, 'Imagen', true),
        'Descripcion' => (string) get_post_meta($post_id, 'Descripcion', true)
    );
}

function eventostri_normalizar_evento($ev) {
    if (!is_array($ev)) {
        return array();
    }

    return array(
        'Titulo' => sanitize_text_field((string) ($ev['Titulo'] ?? 'Evento deportivo')),
        'Fecha_Hora' => sanitize_text_field((string) ($ev['Fecha_Hora'] ?? '')),
        'Lugar' => sanitize_text_field((string) ($ev['Lugar'] ?? '')),
        'Estado' => sanitize_text_field((string) ($ev['Estado'] ?? 'Programado')),
        'Tipos' => sanitize_text_field((string) ($ev['Tipos'] ?? '')),
        'Distancias' => sanitize_text_field((string) ($ev['Distancias'] ?? '')),
        'Link' => esc_url_raw((string) ($ev['Link'] ?? '')),
        'Imagen' => esc_url_raw((string) ($ev['Imagen'] ?? '')),
        'Descripcion' => sanitize_textarea_field((string) ($ev['Descripcion'] ?? ''))
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

function eventostri_rest_sync_eventos(WP_REST_Request $request) {
    $items = $request->get_json_params();

    if (!is_array($items)) {
        return new WP_Error(
            'eventostri_payload_invalido',
            'El cuerpo debe ser un arreglo de eventos.',
            array('status' => 400)
        );
    }

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

    foreach ($items as $item) {
        $evento = eventostri_normalizar_evento($item);

        if (empty($evento['Titulo']) || empty($evento['Fecha_Hora'])) {
            continue;
        }

        $post_id = wp_insert_post(array(
            'post_type' => 'eventostri_evento',
            'post_status' => 'publish',
            'post_title' => $evento['Titulo']
        ), true);

        if (is_wp_error($post_id)) {
            continue;
        }

        $campos_meta = array('Fecha_Hora', 'Lugar', 'Estado', 'Tipos', 'Distancias', 'Link', 'Imagen', 'Descripcion');

        foreach ($campos_meta as $meta_key) {
            update_post_meta($post_id, $meta_key, $evento[$meta_key]);
        }

        $insertados++;
    }

    return rest_ensure_response(array(
        'ok' => true,
        'insertados' => $insertados
    ));
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