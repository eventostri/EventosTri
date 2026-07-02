<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_calendar_default_branding_image_url() {
    return 'https://eventostri.org/wp-content/uploads/2026/01/cropped-eventostriicon.png';
}

function eventostri_calendar_default_event_image_url() {
    return eventostri_calendar_default_branding_image_url();
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

function eventostri_calendar_default_tipo_colors() {
    return array(
        'tipos' => array(
            array('name' => 'MTB', 'color' => '#FF6B6B,#CC5555,#ffffff'),
            array('name' => 'Running', 'color' => '#4ECDC4,#39a399,#ffffff'),
            array('name' => '', 'color' => ''),
            array('name' => '', 'color' => ''),
            array('name' => '', 'color' => ''),
        ),
        'default_color' => '#95E1D3,#76B8B0,#ffffff',
    );
}

function eventostri_calendar_resolve_colors($value) {
    $defaults = eventostri_calendar_default_colors();

    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        }
    }

    if (!is_array($value)) {
        $value = array();
    }

    $resolved = array();
    foreach ($defaults as $key => $default) {
        $candidate = isset($value[$key]) ? sanitize_hex_color($value[$key]) : '';
        $resolved[$key] = $candidate ? $candidate : $default;
    }

    return $resolved;
}

function eventostri_calendar_resolve_labels($value) {
    $defaults = eventostri_calendar_default_labels();

    if (!is_array($value)) {
        $value = array();
    }

    $resolved = array();
    foreach ($defaults as $key => $default) {
        $candidate = isset($value[$key]) ? sanitize_text_field($value[$key]) : '';
        $resolved[$key] = $candidate !== '' ? $candidate : $default;
    }

    return $resolved;
}

function eventostri_calendar_resolve_logo_url($value) {
    $resolved = esc_url_raw(trim((string) $value));
    if ($resolved === '') {
        return eventostri_calendar_default_branding_image_url();
    }

    return $resolved;
}

function eventostri_calendar_get_colors() {
    return eventostri_calendar_resolve_colors(get_option('eventostri_calendar_colors', ''));
}

function eventostri_calendar_get_labels() {
    return eventostri_calendar_resolve_labels(get_option('eventostri_calendar_labels', array()));
}

function eventostri_calendar_get_logo_url() {
    return eventostri_calendar_resolve_logo_url(get_option('eventostri_calendar_background_image', ''));
}

function eventostri_calendar_get_default_event_image_url() {
    $stored = get_option('eventostri_calendar_default_event_image', '');
    $resolved = esc_url_raw(trim((string) $stored));
    if ($resolved === '') {
        return eventostri_calendar_default_event_image_url();
    }

    return $resolved;
}

function eventostri_calendar_resolve_event_image_url($event_image_url) {
    $event_image = esc_url_raw(trim((string) $event_image_url));
    if ($event_image !== '') {
        return $event_image;
    }

    return eventostri_calendar_get_default_event_image_url();
}

function eventostri_sanitize_tipo_color_value($color) {
    $color = sanitize_text_field(trim((string) $color));
    if ($color === '') {
        return '';
    }

    $parts = array_map('trim', explode(',', $color));

    if (count($parts) === 3) {
        $bg     = sanitize_hex_color($parts[0]);
        $border = sanitize_hex_color($parts[1]);
        $text   = sanitize_hex_color($parts[2]);
        if ($bg && $border && $text) {
            return $bg . ',' . $border . ',' . $text;
        }
        return $bg ?: '';
    }

    if (count($parts) === 1) {
        return sanitize_hex_color($parts[0]) ?: '';
    }

    return '';
}

function eventostri_calendar_resolve_tipo_colors($value) {
    $defaults = eventostri_calendar_default_tipo_colors();

    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        }
    }

    if (!is_array($value)) {
        $value = array();
    }

    $tipos = isset($value['tipos']) && is_array($value['tipos']) ? $value['tipos'] : array();
    $resolved_tipos = array();

    foreach ($defaults['tipos'] as $index => $default_tipo) {
        $tipo_entry = isset($tipos[$index]) ? $tipos[$index] : array();
        $name = isset($tipo_entry['name']) ? sanitize_text_field(trim((string) $tipo_entry['name'])) : '';
        $color = isset($tipo_entry['color']) ? eventostri_sanitize_tipo_color_value($tipo_entry['color']) : '';

        if ($name !== '' && $color === '') {
            $color = isset($default_tipo['color']) ? $default_tipo['color'] : '';
        }

        if ($name !== '') {
            $resolved_tipos[] = array(
                'name' => strtolower($name),
                'color' => $color,
            );
        }
    }

    $default_color = isset($value['default_color']) ? eventostri_sanitize_tipo_color_value($value['default_color']) : '';
    if ($default_color === '') {
        $default_color = $defaults['default_color'];
    }

    return array(
        'tipos' => $resolved_tipos,
        'default_color' => $default_color,
    );
}

function eventostri_calendar_get_tipo_colors() {
    $raw = get_option('eventostri_calendar_tipo_colors', '');
    return eventostri_calendar_resolve_tipo_colors($raw);
}

function eventostri_calendar_get_resolved_settings() {
    return array(
        'branding_image_url' => eventostri_calendar_get_logo_url(),
        'default_event_image_url' => eventostri_calendar_get_default_event_image_url(),
        'colors' => eventostri_calendar_get_colors(),
        'labels' => eventostri_calendar_get_labels(),
        'tipo_colors' => eventostri_calendar_get_tipo_colors(),
    );
}

function eventostri_calendar_get_public_script_config() {
    return array(
        'rest' => array(
            'eventosUrl' => esc_url_raw(rest_url('eventostri/v1/eventos')),
        ),
        'settings' => eventostri_calendar_get_resolved_settings(),
    );
}

function eventostri_calendar_get_admin_script_config() {
    return array(
        'rest' => array(
            'eventosUrl' => esc_url_raw(rest_url('eventostri/v1/eventos')),
            'eventosImportUrl' => esc_url_raw(rest_url('eventostri/v1/eventos/import')),
            'eventosDeletePastUrl' => esc_url_raw(rest_url('eventostri/v1/eventos/delete-past')),
            'authStatusUrl' => esc_url_raw(rest_url('eventostri/v1/auth-status')),
        ),
        'exportCsvUrl' => esc_url_raw(wp_nonce_url(admin_url('admin-post.php?action=eventostri_export_csv'), 'eventostri_export_csv')),
        'settings' => eventostri_calendar_get_resolved_settings(),
    );
}

function eventostri_sanitize_calendar_colors($value) {
    return wp_json_encode(eventostri_calendar_resolve_colors($value), JSON_UNESCAPED_SLASHES);
}

function eventostri_sanitize_calendar_labels($value) {
    return eventostri_calendar_resolve_labels($value);
}

function eventostri_sanitize_calendar_tipo_colors($value) {
    return wp_json_encode(eventostri_calendar_resolve_tipo_colors($value), JSON_UNESCAPED_SLASHES);
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
        'eventostri_calendar_default_event_image',
        array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => eventostri_calendar_default_event_image_url(),
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

    register_setting(
        'eventostri_calendar_settings',
        'eventostri_calendar_tipo_colors',
        array(
            'type' => 'string',
            'sanitize_callback' => 'eventostri_sanitize_calendar_tipo_colors',
            'default' => wp_json_encode(eventostri_calendar_default_tipo_colors(), JSON_UNESCAPED_SLASHES),
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
    $default_event_image = eventostri_calendar_get_default_event_image_url();
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
                    <th scope="row"><?php echo esc_html__('Imagen por defecto para eventos', 'eventostri-calendar'); ?></th>
                    <td>
                        <input type="url" id="eventostri_calendar_default_event_image" name="eventostri_calendar_default_event_image" value="<?php echo esc_attr($default_event_image); ?>" class="regular-text" />
                        <button type="button" class="button" id="eventostri_select_default_event_image"><?php echo esc_html__('Seleccionar imagen', 'eventostri-calendar'); ?></button>
                        <p class="description">
                            <?php echo esc_html__('Se usa cuando un evento no tiene Imagen. Recomendado: JPG/PNG, 1200x630 px, menor a 500 KB.', 'eventostri-calendar'); ?>
                        </p>
                        <img id="eventostri_calendar_default_event_preview" src="<?php echo esc_url($default_event_image); ?>" alt="<?php echo esc_attr__('Vista previa de imagen por defecto de eventos', 'eventostri-calendar'); ?>" style="margin-top:10px;max-width:260px;height:auto;border:1px solid #ccd0d4;border-radius:8px;padding:6px;background:#fff;" />
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

                <tr>
                    <th scope="row"><?php echo esc_html__('Colores por Tipo de evento', 'eventostri-calendar'); ?></th>
                    <td>
                        <?php
                        $tipo_colors = eventostri_calendar_get_tipo_colors();
                        $tipo_defaults = eventostri_calendar_default_tipo_colors();
                        ?>
                        <p style="margin-top:0;"><?php echo esc_html__('Configura hasta 5 tipos de eventos con colores personalizados. Los eventos se colorean por el primer tipo que coincida.', 'eventostri-calendar'); ?></p>
                        <p style="font-size:12px;color:#666;margin-bottom:10px;"><?php echo esc_html__('Formato de color: fondo,borde,fuente (ej: #FF6B6B,#CC5555,#ffffff)', 'eventostri-calendar'); ?></p>
                        <fieldset style="border:1px solid #ccd0d4;padding:10px;border-radius:4px;background:#f9f9f9;">
                            <?php for ($i = 0; $i < 5; $i++): ?>
                                <?php
                                $tipo_name = isset($tipo_colors['tipos'][$i]['name']) ? $tipo_colors['tipos'][$i]['name'] : '';
                                $tipo_color = isset($tipo_colors['tipos'][$i]['color']) ? $tipo_colors['tipos'][$i]['color'] : '';
                                ?>
                                <div class="eventostri-tipo-color-row" style="display:flex;gap:10px;margin-bottom:15px;align-items:flex-start;">
                                    <input type="text" placeholder="<?php echo esc_attr__('Ej: MTB, Running, Natacion', 'eventostri-calendar'); ?>" name="eventostri_calendar_tipo_colors[tipos][<?php echo $i; ?>][name]" value="<?php echo esc_attr($tipo_name); ?>" class="regular-text" style="flex:1;max-width:180px;" />
                                    <input type="text" class="eventostri-tipo-color-field" placeholder="#FF6B6B,#CC5555,#ffffff" name="eventostri_calendar_tipo_colors[tipos][<?php echo $i; ?>][color]" value="<?php echo esc_attr($tipo_color); ?>" style="flex:1;max-width:250px;" />
                                    <div class="eventostri-tipo-color-preview" style="flex:0;width:60px;height:40px;border-radius:4px;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;" data-color="<?php echo esc_attr($tipo_color); ?>">
                                        Evento
                                    </div>
                                </div>
                            <?php endfor; ?>
                        </fieldset>
                        <hr style="margin:10px 0;" />
                        <p><?php echo esc_html__('Color por defecto (para tipos no configurados)', 'eventostri-calendar'); ?></p>
                        <div class="eventostri-tipo-color-row" style="display:flex;gap:10px;align-items:flex-start;margin-top:5px;">
                                <input type="text" class="eventostri-tipo-color-field" placeholder="#95E1D3,#76B8B0,#ffffff" name="eventostri_calendar_tipo_colors[default_color]" value="<?php echo esc_attr($tipo_colors['default_color']); ?>" style="flex:1;max-width:250px;" />
                                <div class="eventostri-tipo-color-preview" style="flex:0;width:60px;height:40px;border-radius:4px;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;" data-color="<?php echo esc_attr($tipo_colors['default_color']); ?>">
                                    Evento
                                </div>
                        </div>
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
        var $defaultEventImageInput = $('#eventostri_calendar_default_event_image');
        var $defaultEventImagePreview = $('#eventostri_calendar_default_event_preview');
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

        $('#eventostri_select_default_event_image').on('click', function(e) {
            e.preventDefault();
            var frame = wp.media({
                title: '<?php echo esc_js(__('Selecciona una imagen por defecto para eventos', 'eventostri-calendar')); ?>',
                button: { text: '<?php echo esc_js(__('Usar esta imagen', 'eventostri-calendar')); ?>' },
                multiple: false
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                if (!attachment || !attachment.url) {
                    return;
                }
                $defaultEventImageInput.val(attachment.url);
                $defaultEventImagePreview.attr('src', attachment.url);
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

        // Initialize color pickers for tipo colors
        function updateTipoColorPreview($input) {
            var $row = $input.closest('.eventostri-tipo-color-row');
            var $preview = $row.find('.eventostri-tipo-color-preview').first();
            if ($preview.length === 0) return;
            
            var colorValue = $input.val();
            $preview.data('color', colorValue);
            
            if (!colorValue || colorValue.trim() === '') {
                $preview.css({
                    backgroundColor: '#95E1D3',
                    borderColor: '#76B8B0',
                    color: '#ffffff'
                });
                return;
            }
            
            var parts = colorValue.split(',').map(function(c) { return c.trim(); });
            var bgColor = (parts[0] && parts[0].match(/^#[0-9A-F]{6}$/i)) ? parts[0] : '#95E1D3';
            var borderColor = (parts[1] && parts[1].match(/^#[0-9A-F]{6}$/i)) ? parts[1] : '#76B8B0';
            var textColor = (parts[2] && parts[2].match(/^#[0-9A-F]{6}$/i)) ? parts[2] : '#ffffff';
            
            $preview.css({
                backgroundColor: bgColor,
                borderColor: borderColor,
                color: textColor
            });
        }
        
        var $tipoColorFields = $('.eventostri-tipo-color-field');
        
        $tipoColorFields.on('input change', function() {
            updateTipoColorPreview($(this));
        });
        
        $tipoColorFields.each(function() {
            updateTipoColorPreview($(this));
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
    $settings = eventostri_calendar_get_resolved_settings();
    $colors = $settings['colors'];
    $logo = $settings['branding_image_url'];

    echo '<style id="eventostri-theme-custom-vars">:root{';
    echo '--primary-color:' . esc_attr($colors['primary_color']) . ';';
    echo '--accent-color:' . esc_attr($colors['accent_color']) . ';';
    echo '--secondary-color:' . esc_attr($colors['secondary_color']) . ';';
    echo '--bg-color:' . esc_attr($colors['bg_color']) . ';';
    echo '--calendar-logo:url("' . esc_url($logo) . '");';
    echo '}</style>';
}
add_action('wp_head', 'eventostri_print_calendar_custom_css_variables', 25);
add_action('admin_head', 'eventostri_print_calendar_custom_css_variables', 25);

function eventostri_get_calendar_label($key) {
    $labels = eventostri_calendar_get_labels();
    return isset($labels[$key]) ? $labels[$key] : '';
}
