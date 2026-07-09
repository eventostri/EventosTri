<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_calendar_get_events_rest_url($context = 'admin') {
    $resolved_context = $context === 'public' ? 'public' : 'admin';

    return esc_url_raw(add_query_arg(
        'context',
        $resolved_context,
        rest_url('eventostri/v1/eventos')
    ));
}

function eventostri_calendar_get_request_context($request = null) {
    $context = '';

    if ($request instanceof WP_REST_Request) {
        $context = (string) $request->get_param('context');
    } elseif (isset($_GET['context'])) {
        $context = sanitize_text_field(wp_unslash($_GET['context']));
    }

    return strtolower($context) === 'public' ? 'public' : 'admin';
}

function eventostri_calendar_parse_event_datetime($fecha_hora) {
    $raw_value = trim((string) $fecha_hora);
    if ($raw_value === '') {
        return null;
    }

    try {
        return new DateTimeImmutable($raw_value, wp_timezone());
    } catch (Exception $exception) {
        return null;
    }
}

function eventostri_calendar_get_event_start_timestamp($fecha_hora) {
    $date = eventostri_calendar_parse_event_datetime($fecha_hora);
    if (!$date) {
        return 0;
    }

    return (int) $date->getTimestamp();
}

function eventostri_calendar_get_event_start_date($fecha_hora) {
    $date = eventostri_calendar_parse_event_datetime($fecha_hora);
    if (!$date) {
        return '';
    }

    return $date->format('Y-m-d');
}

function eventostri_calendar_update_event_derived_meta($post_id, $fecha_hora) {
    $timestamp = eventostri_calendar_get_event_start_timestamp($fecha_hora);
    $start_date = eventostri_calendar_get_event_start_date($fecha_hora);

    if ($timestamp > 0) {
        update_post_meta($post_id, '_eventostri_start_ts', $timestamp);
    } else {
        delete_post_meta($post_id, '_eventostri_start_ts');
    }

    if ($start_date !== '') {
        update_post_meta($post_id, '_eventostri_start_date', $start_date);
    } else {
        delete_post_meta($post_id, '_eventostri_start_date');
    }
}

function eventostri_calendar_backfill_event_derived_meta() {
    $schema_version = '1';
    $option_key = 'eventostri_event_meta_schema_version';
    $current_version = (string) get_option($option_key, '');

    if ($current_version === $schema_version) {
        return;
    }

    $consulta = new WP_Query(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true,
    ));

    foreach ($consulta->posts as $post_id) {
        $fecha_hora = (string) get_post_meta($post_id, 'Fecha_Hora', true);
        eventostri_calendar_update_event_derived_meta((int) $post_id, $fecha_hora);
    }

    update_option($option_key, $schema_version, false);
}
add_action('init', 'eventostri_calendar_backfill_event_derived_meta', 20);

function eventostri_calendar_get_public_events_last_changed() {
    $value = (int) get_option('eventostri_public_events_last_changed', 0);
    if ($value > 0) {
        return $value;
    }

    $fallback = time();
    update_option('eventostri_public_events_last_changed', $fallback, false);

    return $fallback;
}

function eventostri_calendar_bump_public_events_last_changed() {
    $timestamp = time();
    update_option('eventostri_public_events_last_changed', $timestamp, false);

    return $timestamp;
}

function eventostri_calendar_get_public_events_cache_key() {
    return 'eventostri_public_events_' . eventostri_calendar_get_public_events_last_changed();
}

function eventostri_calendar_normalize_etag_token($etag) {
    $token = trim((string) $etag);
    if ($token === '') {
        return '';
    }

    if (stripos($token, 'W/') === 0) {
        $token = trim(substr($token, 2));
    }

    return trim($token, " \t\n\r\0\x0B\"");
}

function eventostri_calendar_build_public_events_etag($payload, $last_changed) {
    $hash = md5(wp_json_encode($payload) . '|' . (string) ((int) $last_changed));
    return 'W/"' . $hash . '"';
}

function eventostri_calendar_get_public_last_modified_http($last_changed) {
    $timestamp = (int) $last_changed;
    if ($timestamp <= 0) {
        $timestamp = time();
    }

    return gmdate('D, d M Y H:i:s', $timestamp) . ' GMT';
}

function eventostri_calendar_get_public_events_cache_envelope() {
    $last_changed = eventostri_calendar_get_public_events_last_changed();
    $cache_key = eventostri_calendar_get_public_events_cache_key();
    $cached = get_transient($cache_key);

    if (is_array($cached) && isset($cached['events']) && isset($cached['etag']) && isset($cached['last_changed'])) {
        return $cached;
    }

    $events = is_array($cached)
        ? $cached
        : eventostri_calendar_build_public_events_payload();

    $envelope = array(
        'events' => $events,
        'etag' => eventostri_calendar_build_public_events_etag($events, $last_changed),
        'last_changed' => (int) $last_changed,
    );

    set_transient($cache_key, $envelope, 5 * MINUTE_IN_SECONDS);

    return $envelope;
}

function eventostri_calendar_public_events_request_not_modified($request, $etag, $last_changed) {
    $if_none_match = trim((string) $request->get_header('if-none-match'));
    $if_modified_since = trim((string) $request->get_header('if-modified-since'));
    $normalized_etag = eventostri_calendar_normalize_etag_token($etag);

    if ($if_none_match !== '') {
        if ($if_none_match === '*') {
            return true;
        }

        $candidates = array_map('trim', explode(',', $if_none_match));
        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }

            if (eventostri_calendar_normalize_etag_token($candidate) === $normalized_etag) {
                return true;
            }
        }
    }

    if ($if_modified_since !== '') {
        $if_modified_since_ts = strtotime($if_modified_since);
        if ($if_modified_since_ts && $if_modified_since_ts >= ((int) $last_changed)) {
            return true;
        }
    }

    return false;
}

function eventostri_calendar_apply_public_events_response_headers($response, $etag, $last_changed) {
    if (!($response instanceof WP_REST_Response)) {
        return;
    }

    $response->header('ETag', (string) $etag);
    $response->header('Last-Modified', eventostri_calendar_get_public_last_modified_http($last_changed));
    $response->header('Cache-Control', 'public, max-age=60, must-revalidate');
}

function eventostri_calendar_invalidate_public_events_cache() {
    $previous_key = eventostri_calendar_get_public_events_cache_key();
    delete_transient($previous_key);
    eventostri_calendar_bump_public_events_last_changed();
}

function eventostri_calendar_get_base_events_query_args() {
    return array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'meta_key' => '_eventostri_start_ts',
        'orderby' => 'meta_value_num',
        'order' => 'ASC',
        'no_found_rows' => true,
    );
}

function eventostri_calendar_get_admin_events_payload() {
    $consulta = new WP_Query(eventostri_calendar_get_base_events_query_args());
    $resultado = array();

    if (!empty($consulta->posts)) {
        update_meta_cache('post', $consulta->posts);
    }

    foreach ($consulta->posts as $post_id) {
        $resultado[] = eventostri_map_post_to_array((int) $post_id);
    }

    return $resultado;
}

function eventostri_calendar_build_public_events_payload() {
    $args = eventostri_calendar_get_base_events_query_args();
    $args['meta_query'] = array(
        'relation' => 'OR',
        array(
            'key' => '_eventostri_start_date',
            'compare' => '>=',
            'value' => wp_date('Y-m-d'),
            'type' => 'DATE',
        ),
        array(
            'key' => '_eventostri_start_date',
            'compare' => 'NOT EXISTS',
        ),
    );

    $consulta = new WP_Query($args);
    $resultado = array();

    if (!empty($consulta->posts)) {
        update_meta_cache('post', $consulta->posts);
    }

    foreach ($consulta->posts as $post_id) {
        $post_id = (int) $post_id;
        $evento = eventostri_map_post_to_array($post_id);
        $fecha_hora = (string) ($evento['Fecha_Hora'] ?? '');
        $visible_en_calendario = eventostri_normalizar_visible_en_calendario(
            $evento['VisibleEnCalendario'] ?? null,
            true
        );

        if (!$visible_en_calendario || eventostri_fecha_evento_es_pasada($fecha_hora)) {
            continue;
        }

        $resultado[] = eventostri_calendar_add_public_calendar_actions($evento, $post_id);
    }

    return $resultado;
}

function eventostri_calendar_get_public_events_cached_payload() {
    $envelope = eventostri_calendar_get_public_events_cache_envelope();
    return is_array($envelope['events']) ? $envelope['events'] : array();
}
