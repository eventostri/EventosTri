<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_notification_settings_option_key() {
    return 'eventostri_notification_settings';
}

function eventostri_notification_preferences_user_meta_key() {
    return 'eventostri_notification_preferences';
}

function eventostri_notification_log_table_name() {
    global $wpdb;
    return $wpdb->prefix . 'eventostri_notification_log';
}

function eventostri_notification_default_settings() {
    return array(
        'favorite_day_before_enabled' => true,
        'favorite_day_of_enabled' => true,
        'send_hour_day_before' => 18,
        'send_hour_day_of' => 6,
        'batch_size' => 100,
        'admin_recipients' => array(),
        'admin_notify_on_publish' => true,
        'admin_notify_on_edit' => true,
    );
}

function eventostri_notification_default_preferences() {
    return array(
        'favorite_day_before' => true,
        'favorite_day_of' => true,
        // Forward-compatible keys remain disabled until product approval.
        'new_event_favorite_locations' => false,
        'new_event_favorite_types' => false,
        'updated_at' => gmdate('c'),
    );
}

function eventostri_notification_sanitize_email_list($value) {
    $emails = array();

    if (is_string($value)) {
        $parts = preg_split('/[\n,;]+/', $value);
        $value = is_array($parts) ? $parts : array();
    }

    if (!is_array($value)) {
        return array();
    }

    foreach ($value as $candidate) {
        $email = sanitize_email((string) $candidate);
        if ($email !== '' && is_email($email)) {
            $emails[] = $email;
        }
    }

    return array_values(array_unique($emails));
}

function eventostri_notification_sanitize_settings($value) {
    $defaults = eventostri_notification_default_settings();

    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        }
    }

    if (!is_array($value)) {
        $value = array();
    }

    $has_any_input = !empty($value);

    $send_hour_day_before = isset($value['send_hour_day_before']) ? (int) $value['send_hour_day_before'] : (int) $defaults['send_hour_day_before'];
    $send_hour_day_of = isset($value['send_hour_day_of']) ? (int) $value['send_hour_day_of'] : (int) $defaults['send_hour_day_of'];
    $batch_size = isset($value['batch_size']) ? (int) $value['batch_size'] : (int) $defaults['batch_size'];

    return array(
        'favorite_day_before_enabled' => array_key_exists('favorite_day_before_enabled', $value)
            ? (bool) $value['favorite_day_before_enabled']
            : ($has_any_input ? false : (bool) $defaults['favorite_day_before_enabled']),
        'favorite_day_of_enabled' => array_key_exists('favorite_day_of_enabled', $value)
            ? (bool) $value['favorite_day_of_enabled']
            : ($has_any_input ? false : (bool) $defaults['favorite_day_of_enabled']),
        'send_hour_day_before' => max(0, min(23, $send_hour_day_before)),
        'send_hour_day_of' => max(0, min(23, $send_hour_day_of)),
        'batch_size' => max(1, min(500, $batch_size)),
        'admin_recipients' => eventostri_notification_sanitize_email_list(
            isset($value['admin_recipients']) ? $value['admin_recipients'] : array()
        ),
        'admin_notify_on_publish' => array_key_exists('admin_notify_on_publish', $value)
            ? (bool) $value['admin_notify_on_publish']
            : ($has_any_input ? false : (bool) $defaults['admin_notify_on_publish']),
        'admin_notify_on_edit' => array_key_exists('admin_notify_on_edit', $value)
            ? (bool) $value['admin_notify_on_edit']
            : ($has_any_input ? false : (bool) $defaults['admin_notify_on_edit']),
    );
}

function eventostri_notification_get_settings() {
    $raw = get_option(eventostri_notification_settings_option_key(), array());
    return eventostri_notification_sanitize_settings($raw);
}

function eventostri_notification_sanitize_preferences($value) {
    $defaults = eventostri_notification_default_preferences();

    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        }
    }

    if (!is_array($value)) {
        $value = array();
    }

    return array(
        'favorite_day_before' => array_key_exists('favorite_day_before', $value)
            ? (bool) $value['favorite_day_before']
            : (bool) $defaults['favorite_day_before'],
        'favorite_day_of' => array_key_exists('favorite_day_of', $value)
            ? (bool) $value['favorite_day_of']
            : (bool) $defaults['favorite_day_of'],
        'new_event_favorite_locations' => false,
        'new_event_favorite_types' => false,
        'updated_at' => gmdate('c'),
    );
}

function eventostri_notification_get_user_preferences($user_id) {
    $raw = get_user_meta((int) $user_id, eventostri_notification_preferences_user_meta_key(), true);
    $preferences = eventostri_notification_sanitize_preferences($raw);

    if (!is_array($raw) || $preferences !== $raw) {
        update_user_meta((int) $user_id, eventostri_notification_preferences_user_meta_key(), $preferences);
    }

    return $preferences;
}

function eventostri_notification_set_user_preferences($user_id, $preferences) {
    $sanitized = eventostri_notification_sanitize_preferences($preferences);
    update_user_meta((int) $user_id, eventostri_notification_preferences_user_meta_key(), $sanitized);
    return $sanitized;
}

function eventostri_notification_rest_permission_check() {
    return is_user_logged_in();
}

function eventostri_rest_get_notification_preferences() {
    $user_id = get_current_user_id();
    $preferences = eventostri_notification_get_user_preferences($user_id);

    return rest_ensure_response(array(
        'ok' => true,
        'preferences' => $preferences,
    ));
}

function eventostri_rest_put_notification_preferences(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        $payload = array();
    }

    $incoming = isset($payload['preferences']) && is_array($payload['preferences'])
        ? $payload['preferences']
        : $payload;

    $stored = eventostri_notification_set_user_preferences(get_current_user_id(), $incoming);

    return rest_ensure_response(array(
        'ok' => true,
        'preferences' => $stored,
    ));
}

function eventostri_notification_log_maybe_create_table() {
    global $wpdb;

    $schema_option_key = 'eventostri_notification_log_schema_version';
    $schema_version = '1';
    if ((string) get_option($schema_option_key, '') === $schema_version) {
        return;
    }

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    $table_name = eventostri_notification_log_table_name();
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE {$table_name} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        notification_key VARCHAR(191) NOT NULL,
        notification_type VARCHAR(64) NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        event_id BIGINT UNSIGNED NOT NULL,
        recipient_email VARCHAR(190) NOT NULL,
        target_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payload_json LONGTEXT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        sent_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_notification_key (notification_key),
        KEY idx_type_status_date (notification_type, status, target_date),
        KEY idx_event (event_id),
        KEY idx_user (user_id)
    ) {$charset_collate};";

    dbDelta($sql);
    update_option($schema_option_key, $schema_version, false);
}

function eventostri_notification_register_cron_events() {
    if (!wp_next_scheduled('eventostri_process_favorite_day_before_notifications')) {
        wp_schedule_event(time() + 120, 'hourly', 'eventostri_process_favorite_day_before_notifications');
    }

    if (!wp_next_scheduled('eventostri_process_favorite_day_of_notifications')) {
        wp_schedule_event(time() + 180, 'hourly', 'eventostri_process_favorite_day_of_notifications');
    }

    if (!wp_next_scheduled('eventostri_process_pending_notifications')) {
        wp_schedule_event(time() + 240, 'hourly', 'eventostri_process_pending_notifications');
    }
}

function eventostri_notification_bootstrap() {
    eventostri_notification_log_maybe_create_table();
    eventostri_notification_register_cron_events();
}
add_action('init', 'eventostri_notification_bootstrap', 30);

function eventostri_notification_log_get_by_key($notification_key) {
    global $wpdb;
    $table_name = eventostri_notification_log_table_name();

    return $wpdb->get_row(
        $wpdb->prepare(
            "SELECT * FROM {$table_name} WHERE notification_key = %s LIMIT 1",
            (string) $notification_key
        ),
        ARRAY_A
    );
}

function eventostri_notification_log_has_blocking_status($notification_key) {
    $row = eventostri_notification_log_get_by_key($notification_key);
    if (!$row || !isset($row['status'])) {
        return false;
    }

    return in_array((string) $row['status'], array('sent', 'sending', 'skipped'), true);
}

function eventostri_notification_log_insert($row) {
    global $wpdb;
    $table_name = eventostri_notification_log_table_name();
    $now = current_time('mysql', true);

    $inserted = $wpdb->insert(
        $table_name,
        array(
            'notification_key' => (string) $row['notification_key'],
            'notification_type' => (string) $row['notification_type'],
            'user_id' => isset($row['user_id']) ? (int) $row['user_id'] : null,
            'event_id' => (int) $row['event_id'],
            'recipient_email' => (string) $row['recipient_email'],
            'target_date' => (string) $row['target_date'],
            'status' => isset($row['status']) ? (string) $row['status'] : 'pending',
            'payload_json' => isset($row['payload_json']) ? (string) $row['payload_json'] : '',
            'created_at' => $now,
            'updated_at' => $now,
            'sent_at' => null,
        ),
        array('%s', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s')
    );

    if (!$inserted) {
        return false;
    }

    return (int) $wpdb->insert_id;
}

function eventostri_notification_log_update_status($id, $status, $sent_at = null) {
    global $wpdb;
    $table_name = eventostri_notification_log_table_name();

    $data = array(
        'status' => (string) $status,
        'updated_at' => current_time('mysql', true),
    );
    $format = array('%s', '%s');

    if ($sent_at !== null) {
        $data['sent_at'] = (string) $sent_at;
        $format[] = '%s';
    }

    return (bool) $wpdb->update(
        $table_name,
        $data,
        array('id' => (int) $id),
        $format,
        array('%d')
    );
}

function eventostri_notification_build_favorite_key($notification_type, $user_id, $event_id, $target_date) {
    return sanitize_key((string) $notification_type) . ':' . (int) $user_id . ':' . (int) $event_id . ':' . (string) $target_date;
}

function eventostri_notification_build_admin_key($notification_type, $event_id, $post_modified_gmt, $recipient_email) {
    $email_hash = md5(strtolower(trim((string) $recipient_email)));
    return sanitize_key((string) $notification_type) . ':' . (int) $event_id . ':' . sanitize_key((string) $post_modified_gmt) . ':' . $email_hash;
}

function eventostri_notification_queue_if_missing($payload) {
    $required = array('notification_key', 'notification_type', 'event_id', 'recipient_email', 'target_date');
    foreach ($required as $field) {
        if (!isset($payload[$field]) || (string) $payload[$field] === '') {
            return false;
        }
    }

    if (eventostri_notification_log_has_blocking_status($payload['notification_key'])) {
        return false;
    }

    $existing = eventostri_notification_log_get_by_key($payload['notification_key']);
    if (is_array($existing)) {
        $status = isset($existing['status']) ? (string) $existing['status'] : '';
        if ($status === 'failed') {
            return eventostri_notification_log_update_status((int) $existing['id'], 'pending');
        }
        return false;
    }

    return eventostri_notification_log_insert($payload) !== false;
}

function eventostri_notification_get_event_email_payload($event_id) {
    $event_id = (int) $event_id;
    $post = get_post($event_id);
    if (!$post || $post->post_type !== 'eventostri_evento') {
        return null;
    }

    $evento = eventostri_map_post_to_array($event_id);
    $fecha = isset($evento['Fecha_Hora']) ? (string) $evento['Fecha_Hora'] : '';
    $lugar = isset($evento['Lugar']) ? (string) $evento['Lugar'] : '';

    return array(
        'id' => $event_id,
        'title' => (string) get_the_title($event_id),
        'fecha_hora' => $fecha,
        'lugar' => $lugar,
        'link' => (string) get_post_meta($event_id, 'Link', true),
    );
}

function eventostri_notification_build_email_subject($notification_type, $event_payload) {
    $title = isset($event_payload['title']) ? (string) $event_payload['title'] : 'Evento';

    if ($notification_type === 'favorite_day_before') {
        return 'Recordatorio: manana es ' . $title;
    }
    if ($notification_type === 'favorite_day_of') {
        return 'Recordatorio: hoy es ' . $title;
    }
    if ($notification_type === 'admin_event_published') {
        return 'Evento publicado: ' . $title;
    }
    if ($notification_type === 'admin_event_updated') {
        return 'Evento actualizado: ' . $title;
    }

    return 'Notificacion de evento: ' . $title;
}

function eventostri_notification_build_email_body($notification_type, $event_payload) {
    $title = isset($event_payload['title']) ? (string) $event_payload['title'] : 'Evento';
    $fecha_hora = isset($event_payload['fecha_hora']) ? (string) $event_payload['fecha_hora'] : '';
    $lugar = isset($event_payload['lugar']) ? (string) $event_payload['lugar'] : '';
    $link = isset($event_payload['link']) ? (string) $event_payload['link'] : '';

    $lineas = array();

    if ($notification_type === 'favorite_day_before') {
        $lineas[] = 'Recordatorio de favorito para manana.';
    } elseif ($notification_type === 'favorite_day_of') {
        $lineas[] = 'Recordatorio de favorito para hoy.';
    } elseif ($notification_type === 'admin_event_published') {
        $lineas[] = 'Se ha publicado un evento.';
    } elseif ($notification_type === 'admin_event_updated') {
        $lineas[] = 'Se ha actualizado un evento.';
    } else {
        $lineas[] = 'Notificacion de evento.';
    }

    $lineas[] = 'Titulo: ' . $title;
    if ($fecha_hora !== '') {
        $lineas[] = 'Fecha/Hora: ' . $fecha_hora;
    }
    if ($lugar !== '') {
        $lineas[] = 'Lugar: ' . $lugar;
    }
    if ($link !== '') {
        $lineas[] = 'Enlace: ' . $link;
    }

    return implode("\n", $lineas);
}

function eventostri_notification_send_pending_batch() {
    global $wpdb;
    $table_name = eventostri_notification_log_table_name();
    $settings = eventostri_notification_get_settings();
    $batch_size = max(1, (int) $settings['batch_size']);

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM {$table_name} WHERE status = %s ORDER BY id ASC LIMIT %d",
            'pending',
            $batch_size
        ),
        ARRAY_A
    );

    if (empty($rows)) {
        return;
    }

    foreach ($rows as $row) {
        $id = (int) $row['id'];
        if ($id <= 0) {
            continue;
        }

        eventostri_notification_log_update_status($id, 'sending');

        $payload = array();
        if (!empty($row['payload_json'])) {
            $decoded = json_decode((string) $row['payload_json'], true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }
        if (empty($payload)) {
            $event_payload = eventostri_notification_get_event_email_payload((int) $row['event_id']);
            if (is_array($event_payload)) {
                $payload = $event_payload;
            }
        }

        $subject = eventostri_notification_build_email_subject((string) $row['notification_type'], $payload);
        $body = eventostri_notification_build_email_body((string) $row['notification_type'], $payload);

        $sent = wp_mail((string) $row['recipient_email'], $subject, $body);
        if ($sent) {
            eventostri_notification_log_update_status($id, 'sent', current_time('mysql', true));
        } else {
            eventostri_notification_log_update_status($id, 'failed');
        }
    }
}
add_action('eventostri_process_pending_notifications', 'eventostri_notification_send_pending_batch');

function eventostri_notification_should_run_at_hour($configured_hour) {
    $timezone = wp_timezone();
    $now = new DateTimeImmutable('now', $timezone);
    return ((int) $now->format('G')) === (int) $configured_hour;
}

function eventostri_notification_collect_favorite_candidates($target_date, $preference_key) {
    $target = (string) $target_date;
    if ($target === '') {
        return array();
    }

    $users = get_users(array(
        'fields' => array('ID', 'user_email'),
    ));

    $candidates = array();
    foreach ($users as $user) {
        $user_id = isset($user->ID) ? (int) $user->ID : 0;
        $email = isset($user->user_email) ? sanitize_email((string) $user->user_email) : '';

        if ($user_id <= 0 || $email === '' || !is_email($email)) {
            continue;
        }

        $preferences = eventostri_notification_get_user_preferences($user_id);
        if (empty($preferences[$preference_key])) {
            continue;
        }

        $favorite_ids = eventostri_favorites_get_user_ids($user_id);
        if (empty($favorite_ids)) {
            continue;
        }

        $query = new WP_Query(array(
            'post_type' => 'eventostri_evento',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'post__in' => array_map('intval', $favorite_ids),
            'meta_query' => array(
                array(
                    'key' => '_eventostri_start_date',
                    'value' => $target,
                    'compare' => '=',
                ),
            ),
            'no_found_rows' => true,
        ));

        foreach ($query->posts as $event_id) {
            $event_id = (int) $event_id;
            if ($event_id <= 0) {
                continue;
            }

            $visible = eventostri_normalizar_visible_en_calendario(get_post_meta($event_id, 'VisibleEnCalendario', true), true);
            if (!$visible) {
                continue;
            }

            $candidates[] = array(
                'user_id' => $user_id,
                'recipient_email' => $email,
                'event_id' => $event_id,
            );
        }
    }

    return $candidates;
}

function eventostri_notification_queue_favorite_notifications($notification_type, $target_date, $preference_key) {
    $candidates = eventostri_notification_collect_favorite_candidates($target_date, $preference_key);

    foreach ($candidates as $candidate) {
        $key = eventostri_notification_build_favorite_key(
            $notification_type,
            $candidate['user_id'],
            $candidate['event_id'],
            $target_date
        );

        $event_payload = eventostri_notification_get_event_email_payload($candidate['event_id']);

        eventostri_notification_queue_if_missing(array(
            'notification_key' => $key,
            'notification_type' => $notification_type,
            'user_id' => (int) $candidate['user_id'],
            'event_id' => (int) $candidate['event_id'],
            'recipient_email' => (string) $candidate['recipient_email'],
            'target_date' => (string) $target_date,
            'status' => 'pending',
            'payload_json' => wp_json_encode($event_payload),
        ));
    }
}

function eventostri_process_favorite_day_before_notifications() {
    $settings = eventostri_notification_get_settings();
    if (empty($settings['favorite_day_before_enabled'])) {
        return;
    }
    if (!eventostri_notification_should_run_at_hour((int) $settings['send_hour_day_before'])) {
        return;
    }

    $timezone = wp_timezone();
    $target_date = (new DateTimeImmutable('now', $timezone))
        ->modify('+1 day')
        ->format('Y-m-d');

    eventostri_notification_queue_favorite_notifications(
        'favorite_day_before',
        $target_date,
        'favorite_day_before'
    );
    eventostri_notification_send_pending_batch();
}
add_action('eventostri_process_favorite_day_before_notifications', 'eventostri_process_favorite_day_before_notifications');

function eventostri_process_favorite_day_of_notifications() {
    $settings = eventostri_notification_get_settings();
    if (empty($settings['favorite_day_of_enabled'])) {
        return;
    }
    if (!eventostri_notification_should_run_at_hour((int) $settings['send_hour_day_of'])) {
        return;
    }

    $timezone = wp_timezone();
    $target_date = (new DateTimeImmutable('now', $timezone))->format('Y-m-d');

    eventostri_notification_queue_favorite_notifications(
        'favorite_day_of',
        $target_date,
        'favorite_day_of'
    );
    eventostri_notification_send_pending_batch();
}
add_action('eventostri_process_favorite_day_of_notifications', 'eventostri_process_favorite_day_of_notifications');

function eventostri_notification_get_admin_recipients() {
    $settings = eventostri_notification_get_settings();
    return isset($settings['admin_recipients']) && is_array($settings['admin_recipients'])
        ? eventostri_notification_sanitize_email_list($settings['admin_recipients'])
        : array();
}

function eventostri_notification_queue_admin_notifications($notification_type, $post_id) {
    $post_id = (int) $post_id;
    if ($post_id <= 0) {
        return;
    }

    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'eventostri_evento' || $post->post_status !== 'publish') {
        return;
    }

    $recipients = eventostri_notification_get_admin_recipients();
    if (empty($recipients)) {
        return;
    }

    $post_modified_gmt = !empty($post->post_modified_gmt)
        ? (string) $post->post_modified_gmt
        : gmdate('Y-m-d H:i:s');
    $target_date = gmdate('Y-m-d');
    $event_payload = eventostri_notification_get_event_email_payload($post_id);

    foreach ($recipients as $email) {
        $key = eventostri_notification_build_admin_key($notification_type, $post_id, $post_modified_gmt, $email);

        eventostri_notification_queue_if_missing(array(
            'notification_key' => $key,
            'notification_type' => $notification_type,
            'user_id' => null,
            'event_id' => $post_id,
            'recipient_email' => $email,
            'target_date' => $target_date,
            'status' => 'pending',
            'payload_json' => wp_json_encode($event_payload),
        ));
    }
}

function eventostri_notification_handle_transition_post_status($new_status, $old_status, $post) {
    if (!$post || $post->post_type !== 'eventostri_evento') {
        return;
    }

    if ($new_status === 'publish' && $old_status !== 'publish') {
        $settings = eventostri_notification_get_settings();
        if (!empty($settings['admin_notify_on_publish'])) {
            eventostri_notification_queue_admin_notifications('admin_event_published', (int) $post->ID);
        }
    }
}
add_action('transition_post_status', 'eventostri_notification_handle_transition_post_status', 10, 3);

function eventostri_notification_handle_save_post_event($post_id, $post, $update) {
    if (!$update || !$post || $post->post_type !== 'eventostri_evento') {
        return;
    }

    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }

    if ($post->post_status !== 'publish') {
        return;
    }

    $settings = eventostri_notification_get_settings();
    if (empty($settings['admin_notify_on_edit'])) {
        return;
    }

    eventostri_notification_queue_admin_notifications('admin_event_updated', (int) $post_id);
}
add_action('save_post_eventostri_evento', 'eventostri_notification_handle_save_post_event', 20, 3);

function eventostri_notification_register_rest_routes() {
    register_rest_route('eventostri/v1', '/notification-preferences', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'eventostri_rest_get_notification_preferences',
            'permission_callback' => 'eventostri_notification_rest_permission_check',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'eventostri_rest_put_notification_preferences',
            'permission_callback' => 'eventostri_notification_rest_permission_check',
        ),
    ));
}
add_action('rest_api_init', 'eventostri_notification_register_rest_routes');
