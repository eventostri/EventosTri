<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_calendar_default_branding_image_url() {
    return 'https://eventostri.org/wp-content/uploads/2026/01/cropped-eventostriicon.png';
}

function eventostri_calendar_default_colors() {
    return array(
        'primary_color' => '#0b5fff',
        'accent_color' => '#00c2ff',
        'secondary_color' => '#ff7a59',
        'bg_color' => '#eef6ff',
    );
}

function eventostri_calendar_default_labels() {
    return array(
        'new_event' => __('Nuevo evento', 'eventostri-calendar'),
        'import_csv' => __('Importar CSV', 'eventostri-calendar'),
        'export_csv' => __('Exportar CSV', 'eventostri-calendar'),
        'delete_past' => __('Eliminar eventos pasados', 'eventostri-calendar'),
    );
}

function eventostri_calendar_get_colors() {
    $defaults = eventostri_calendar_default_colors();
    $raw = get_option('eventostri_calendar_colors', '');

    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return wp_parse_args($decoded, $defaults);
        }
    }

    if (is_array($raw)) {
        return wp_parse_args($raw, $defaults);
    }

    return $defaults;
}

function eventostri_calendar_get_labels() {
    $defaults = eventostri_calendar_default_labels();
    $raw = get_option('eventostri_calendar_labels', array());
    if (!is_array($raw)) {
        $raw = array();
    }
    return wp_parse_args($raw, $defaults);
}

function eventostri_calendar_get_logo_url() {
    $stored = trim((string) get_option('eventostri_calendar_background_image', ''));
    if ($stored === '') {
        return eventostri_calendar_default_branding_image_url();
    }
    return $stored;
}

function eventostri_sanitize_calendar_colors($value) {
    $defaults = eventostri_calendar_default_colors();
    $sanitized = array();

    if (!is_array($value)) {
        $value = array();
    }

    foreach ($defaults as $key => $default) {
        $candidate = isset($value[$key]) ? sanitize_hex_color($value[$key]) : '';
        $sanitized[$key] = $candidate ? $candidate : $default;
    }

    return wp_json_encode($sanitized, JSON_UNESCAPED_SLASHES);
}

function eventostri_sanitize_calendar_labels($value) {
    $defaults = eventostri_calendar_default_labels();
    $sanitized = array();

    if (!is_array($value)) {
        $value = array();
    }

    foreach ($defaults as $key => $default) {
        $candidate = isset($value[$key]) ? sanitize_text_field($value[$key]) : '';
        $sanitized[$key] = $candidate !== '' ? $candidate : $default;
    }

    return $sanitized;
}

function eventostri_register_calendar_settings() {
    register_setting(
        'eventostri_calendar_settings',
        'eventostri_calendar_background_image',
        array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => eventostri_calendar_default_branding_image_url(),
        )
    );

    register_setting(
        'eventostri_calendar_settings',
        'eventostri_calendar_colors',
        array(
            'type' => 'string',
            'sanitize_callback' => 'eventostri_sanitize_calendar_colors',
            'default' => wp_json_encode(eventostri_calendar_default_colors(), JSON_UNESCAPED_SLASHES),
        )
    );

    register_setting(
        'eventostri_calendar_settings',
        'eventostri_calendar_labels',
        array(
            'type' => 'array',
            'sanitize_callback' => 'eventostri_sanitize_calendar_labels',
            'default' => eventostri_calendar_default_labels(),
        )
    );
}
add_action('admin_init', 'eventostri_register_calendar_settings');

function eventostri_add_calendar_settings_page() {
    add_submenu_page(
        'edit.php?post_type=eventostri_evento',
        __('Configuracion del calendario', 'eventostri-calendar'),
        __('Configuracion', 'eventostri-calendar'),
        'manage_options',
        'eventostri-settings',
        'eventostri_render_calendar_settings_page'
    );
}
add_action('admin_menu', 'eventostri_add_calendar_settings_page');

function eventostri_calendar_settings_admin_assets($hook_suffix) {
    if ($hook_suffix !== 'eventostri_evento_page_eventostri-settings') {
        return;
    }

    wp_enqueue_media();
    wp_enqueue_style('wp-color-picker');
    wp_enqueue_script('wp-color-picker');
}
add_action('admin_enqueue_scripts', 'eventostri_calendar_settings_admin_assets');

function eventostri_render_calendar_settings_page() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('No tienes permisos para ver esta pagina.', 'eventostri-calendar'));
    }

    $colors = eventostri_calendar_get_colors();
    $labels = eventostri_calendar_get_labels();
    $logo = eventostri_calendar_get_logo_url();
    $defaults = eventostri_calendar_default_colors();
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Configuracion de EventosTri Calendar', 'eventostri-calendar'); ?></h1>
        <p><?php echo esc_html__('Personaliza imagen, colores y etiquetas principales del calendario.', 'eventostri-calendar'); ?></p>

        <form method="post" action="options.php">
            <?php settings_fields('eventostri_calendar_settings'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><?php echo esc_html__('Imagen de fondo del calendario', 'eventostri-calendar'); ?></th>
                    <td>
                        <input type="url" id="eventostri_calendar_background_image" name="eventostri_calendar_background_image" value="<?php echo esc_attr($logo); ?>" class="regular-text" />
                        <button type="button" class="button" id="eventostri_select_background_image"><?php echo esc_html__('Seleccionar imagen', 'eventostri-calendar'); ?></button>
                        <p class="description">
                            <?php echo esc_html__('Recomendado: formato PNG/JPG, minimo 600x600 px, peso menor a 400 KB.', 'eventostri-calendar'); ?>
                        </p>
                        <img id="eventostri_calendar_background_preview" src="<?php echo esc_url($logo); ?>" alt="<?php echo esc_attr__('Vista previa de fondo', 'eventostri-calendar'); ?>" style="margin-top:10px;max-width:180px;height:auto;border:1px solid #ccd0d4;border-radius:8px;padding:6px;background:#fff;" />
                    </td>
                </tr>

                <tr>
                    <th scope="row"><?php echo esc_html__('Esquema de colores', 'eventostri-calendar'); ?></th>
                    <td>
                        <fieldset>
                            <p><label><?php echo esc_html__('Color primario', 'eventostri-calendar'); ?><br><input type="text" class="eventostri-color-field" data-default-color="<?php echo esc_attr($defaults['primary_color']); ?>" name="eventostri_calendar_colors[primary_color]" value="<?php echo esc_attr($colors['primary_color']); ?>"></label></p>
                            <p><label><?php echo esc_html__('Color acento', 'eventostri-calendar'); ?><br><input type="text" class="eventostri-color-field" data-default-color="<?php echo esc_attr($defaults['accent_color']); ?>" name="eventostri_calendar_colors[accent_color]" value="<?php echo esc_attr($colors['accent_color']); ?>"></label></p>
                            <p><label><?php echo esc_html__('Color secundario', 'eventostri-calendar'); ?><br><input type="text" class="eventostri-color-field" data-default-color="<?php echo esc_attr($defaults['secondary_color']); ?>" name="eventostri_calendar_colors[secondary_color]" value="<?php echo esc_attr($colors['secondary_color']); ?>"></label></p>
                            <p><label><?php echo esc_html__('Color de fondo', 'eventostri-calendar'); ?><br><input type="text" class="eventostri-color-field" data-default-color="<?php echo esc_attr($defaults['bg_color']); ?>" name="eventostri_calendar_colors[bg_color]" value="<?php echo esc_attr($colors['bg_color']); ?>"></label></p>
                        </fieldset>
                        <button type="button" class="button" id="eventostri_reset_colors"><?php echo esc_html__('Restablecer colores por defecto', 'eventostri-calendar'); ?></button>
                        <div id="eventostri_color_preview" style="margin-top:12px;padding:12px;border-radius:10px;border:1px solid #d0d7de;background:#fff;max-width:360px;">
                            <strong style="display:block;margin-bottom:8px;"><?php echo esc_html__('Vista previa', 'eventostri-calendar'); ?></strong>
                            <span id="eventostri_preview_chip" style="display:inline-block;padding:6px 12px;border-radius:999px;color:#fff;font-weight:600;"><?php echo esc_html__('Boton principal', 'eventostri-calendar'); ?></span>
                        </div>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><?php echo esc_html__('Etiquetas configurables', 'eventostri-calendar'); ?></th>
                    <td>
                        <p><label><?php echo esc_html__('Nuevo evento', 'eventostri-calendar'); ?><br><input type="text" class="regular-text" name="eventostri_calendar_labels[new_event]" value="<?php echo esc_attr($labels['new_event']); ?>"></label></p>
                        <p><label><?php echo esc_html__('Importar CSV', 'eventostri-calendar'); ?><br><input type="text" class="regular-text" name="eventostri_calendar_labels[import_csv]" value="<?php echo esc_attr($labels['import_csv']); ?>"></label></p>
                        <p><label><?php echo esc_html__('Exportar CSV', 'eventostri-calendar'); ?><br><input type="text" class="regular-text" name="eventostri_calendar_labels[export_csv]" value="<?php echo esc_attr($labels['export_csv']); ?>"></label></p>
                        <p><label><?php echo esc_html__('Eliminar eventos pasados', 'eventostri-calendar'); ?><br><input type="text" class="regular-text" name="eventostri_calendar_labels[delete_past]" value="<?php echo esc_attr($labels['delete_past']); ?>"></label></p>
                    </td>
                </tr>
            </table>

            <?php submit_button(__('Guardar configuracion', 'eventostri-calendar')); ?>
        </form>
    </div>
    <script>
    (function($) {
        var $logoInput = $('#eventostri_calendar_background_image');
        var $logoPreview = $('#eventostri_calendar_background_preview');
        var $previewChip = $('#eventostri_preview_chip');
        var $colorFields = $('.eventostri-color-field');

        $('#eventostri_select_background_image').on('click', function(e) {
            e.preventDefault();
            var frame = wp.media({
                title: '<?php echo esc_js(__('Selecciona una imagen de fondo', 'eventostri-calendar')); ?>',
                button: { text: '<?php echo esc_js(__('Usar esta imagen', 'eventostri-calendar')); ?>' },
                multiple: false
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                if (!attachment || !attachment.url) {
                    return;
                }
                $logoInput.val(attachment.url);
                $logoPreview.attr('src', attachment.url);
            });

            frame.open();
        });

        function updatePreview() {
            var primary = $('input[name="eventostri_calendar_colors[primary_color]"]').val() || '#0b5fff';
            var accent = $('input[name="eventostri_calendar_colors[accent_color]"]').val() || '#00c2ff';
            $previewChip.css({
                background: 'linear-gradient(90deg, ' + primary + ', ' + accent + ')'
            });
        }

        $colorFields.wpColorPicker({
            change: updatePreview,
            clear: updatePreview
        });

        $('#eventostri_reset_colors').on('click', function(e) {
            e.preventDefault();
            $colorFields.each(function() {
                var $field = $(this);
                var fallback = $field.data('default-color');
                $field.wpColorPicker('color', fallback);
            });
            updatePreview();
        });

        updatePreview();
    })(jQuery);
    </script>
    <?php
}

function eventostri_print_calendar_custom_css_variables() {
    $colors = eventostri_calendar_get_colors();
    $logo = eventostri_calendar_get_logo_url();

    $primary = sanitize_hex_color($colors['primary_color']);
    $accent = sanitize_hex_color($colors['accent_color']);
    $secondary = sanitize_hex_color($colors['secondary_color']);
    $bg = sanitize_hex_color($colors['bg_color']);

    $primary = $primary ? $primary : '#0b5fff';
    $accent = $accent ? $accent : '#00c2ff';
    $secondary = $secondary ? $secondary : '#ff7a59';
    $bg = $bg ? $bg : '#eef6ff';
    $logo = $logo ? esc_url_raw($logo) : eventostri_calendar_default_branding_image_url();

    echo '<style id="eventostri-theme-custom-vars">:root{';
    echo '--primary-color:' . esc_attr($primary) . ';';
    echo '--accent-color:' . esc_attr($accent) . ';';
    echo '--secondary-color:' . esc_attr($secondary) . ';';
    echo '--bg-color:' . esc_attr($bg) . ';';
    echo '--calendar-logo:url("' . esc_url($logo) . '");';
    echo '}</style>';
}
add_action('wp_head', 'eventostri_print_calendar_custom_css_variables', 25);
add_action('admin_head', 'eventostri_print_calendar_custom_css_variables', 25);

function eventostri_get_calendar_label($key) {
    $labels = eventostri_calendar_get_labels();
    return isset($labels[$key]) ? $labels[$key] : '';
}
