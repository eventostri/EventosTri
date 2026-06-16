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