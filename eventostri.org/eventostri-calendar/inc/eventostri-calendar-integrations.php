<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_calendar_default_integration_settings() {
    return array(
        'default_duration_minutes' => 120,
        'feed_title' => 'EventosTri Calendar',
        'feed_description' => 'Suscripcion de eventos publicados en EventosTri',
    );
}

function eventostri_calendar_sanitize_integration_settings($value) {
    $defaults = eventostri_calendar_default_integration_settings();

    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        }
    }

    if (!is_array($value)) {
        $value = array();
    }

    $duration = isset($value['default_duration_minutes']) ? (int) $value['default_duration_minutes'] : (int) $defaults['default_duration_minutes'];
    if ($duration <= 0) {
        $duration = (int) $defaults['default_duration_minutes'];
    }

    $feed_title = isset($value['feed_title']) ? sanitize_text_field((string) $value['feed_title']) : '';
    if ($feed_title === '') {
        $feed_title = $defaults['feed_title'];
    }

    $feed_description = isset($value['feed_description']) ? sanitize_text_field((string) $value['feed_description']) : '';
    if ($feed_description === '') {
        $feed_description = $defaults['feed_description'];
    }

    return array(
        'default_duration_minutes' => $duration,
        'feed_title' => $feed_title,
        'feed_description' => $feed_description,
    );
}

function eventostri_calendar_get_integration_settings() {
    $raw = get_option('eventostri_calendar_integration_settings', array());
    return eventostri_calendar_sanitize_integration_settings($raw);
}

function eventostri_calendar_get_recurrence_rule($post_id) {
    $keys = array('RRULE', 'RRule', 'rrule', 'RecurrenceRule');
    foreach ($keys as $key) {
        $value = trim((string) get_post_meta($post_id, $key, true));
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function eventostri_calendar_build_export_payload($post_id) {
    $post_id = (int) $post_id;
    if ($post_id <= 0) {
        return null;
    }

    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'eventostri_evento' || $post->post_status !== 'publish') {
        return null;
    }

    $visible_meta = get_post_meta($post_id, 'VisibleEnCalendario', true);
    $visible_en_calendario = eventostri_normalizar_visible_en_calendario($visible_meta, true);
    if (!$visible_en_calendario) {
        return null;
    }

    $evento = eventostri_map_post_to_array($post_id);
    $start_raw = isset($evento['Fecha_Hora']) ? (string) $evento['Fecha_Hora'] : '';
    $start_date = eventostri_calendar_parse_event_datetime($start_raw);
    if (!$start_date) {
        return null;
    }

    $settings = eventostri_calendar_get_integration_settings();
    $duration_minutes = (int) $settings['default_duration_minutes'];
    if ($duration_minutes <= 0) {
        $duration_minutes = 120;
    }

    $end_date = $start_date->add(new DateInterval('PT' . $duration_minutes . 'M'));
    $timezone = wp_timezone_string();
    if ($timezone === '') {
        $timezone = 'UTC';
    }

    $site_host = wp_parse_url(home_url('/'), PHP_URL_HOST);
    if (!is_string($site_host) || $site_host === '') {
        $site_host = 'eventostri.local';
    }

    $rrule = eventostri_calendar_get_recurrence_rule($post_id);

    return array(
        'id' => $post_id,
        'title' => isset($evento['Titulo']) ? (string) $evento['Titulo'] : '',
        'description' => isset($evento['Descripcion']) ? (string) $evento['Descripcion'] : '',
        'location' => isset($evento['Lugar']) ? (string) $evento['Lugar'] : '',
        'url' => isset($evento['Link']) ? (string) $evento['Link'] : '',
        'start' => $start_date,
        'end' => $end_date,
        'timezone' => $timezone,
        'uid' => 'eventostri-' . $post_id . '@' . $site_host,
        'rrule' => $rrule,
    );
}

function eventostri_calendar_escape_ics_text($value) {
    $text = (string) $value;
    $text = str_replace('\\', '\\\\', $text);
    $text = str_replace(array("\r\n", "\r", "\n"), '\\n', $text);
    $text = str_replace(',', '\\,', $text);
    $text = str_replace(';', '\\;', $text);
    return $text;
}

function eventostri_calendar_format_ics_datetime(DateTimeInterface $date) {
    $utc = DateTimeImmutable::createFromInterface($date)->setTimezone(new DateTimeZone('UTC'));
    return $utc->format('Ymd\\THis\\Z');
}

function eventostri_calendar_render_ics_event($payload) {
    if (!is_array($payload) || !isset($payload['start']) || !($payload['start'] instanceof DateTimeInterface)) {
        return '';
    }

    $start = $payload['start'];
    $end = isset($payload['end']) && $payload['end'] instanceof DateTimeInterface
        ? $payload['end']
        : DateTimeImmutable::createFromInterface($start)->add(new DateInterval('PT120M'));

    $lines = array(
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//EventosTri//EventosTri Calendar//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' . eventostri_calendar_escape_ics_text(isset($payload['uid']) ? $payload['uid'] : ''),
        'DTSTAMP:' . gmdate('Ymd\\THis\\Z'),
        'DTSTART:' . eventostri_calendar_format_ics_datetime($start),
        'DTEND:' . eventostri_calendar_format_ics_datetime($end),
        'SUMMARY:' . eventostri_calendar_escape_ics_text(isset($payload['title']) ? $payload['title'] : ''),
    );

    if (!empty($payload['description'])) {
        $lines[] = 'DESCRIPTION:' . eventostri_calendar_escape_ics_text($payload['description']);
    }
    if (!empty($payload['location'])) {
        $lines[] = 'LOCATION:' . eventostri_calendar_escape_ics_text($payload['location']);
    }
    if (!empty($payload['url'])) {
        $lines[] = 'URL:' . esc_url_raw($payload['url']);
    }
    if (!empty($payload['rrule'])) {
        $lines[] = 'RRULE:' . strtoupper(sanitize_text_field((string) $payload['rrule']));
    }

    $lines[] = 'END:VEVENT';
    $lines[] = 'END:VCALENDAR';

    return implode("\r\n", $lines) . "\r\n";
}

function eventostri_calendar_render_ics_feed($events) {
    $settings = eventostri_calendar_get_integration_settings();
    $lines = array(
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//EventosTri//EventosTri Calendar Feed//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' . eventostri_calendar_escape_ics_text($settings['feed_title']),
        'X-WR-CALDESC:' . eventostri_calendar_escape_ics_text($settings['feed_description']),
    );

    foreach ($events as $payload) {
        if (!is_array($payload) || !isset($payload['start']) || !($payload['start'] instanceof DateTimeInterface)) {
            continue;
        }

        $start = $payload['start'];
        $end = isset($payload['end']) && $payload['end'] instanceof DateTimeInterface
            ? $payload['end']
            : DateTimeImmutable::createFromInterface($start)->add(new DateInterval('PT120M'));

        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:' . eventostri_calendar_escape_ics_text(isset($payload['uid']) ? $payload['uid'] : '');
        $lines[] = 'DTSTAMP:' . gmdate('Ymd\\THis\\Z');
        $lines[] = 'DTSTART:' . eventostri_calendar_format_ics_datetime($start);
        $lines[] = 'DTEND:' . eventostri_calendar_format_ics_datetime($end);
        $lines[] = 'SUMMARY:' . eventostri_calendar_escape_ics_text(isset($payload['title']) ? $payload['title'] : '');
        if (!empty($payload['description'])) {
            $lines[] = 'DESCRIPTION:' . eventostri_calendar_escape_ics_text($payload['description']);
        }
        if (!empty($payload['location'])) {
            $lines[] = 'LOCATION:' . eventostri_calendar_escape_ics_text($payload['location']);
        }
        if (!empty($payload['url'])) {
            $lines[] = 'URL:' . esc_url_raw($payload['url']);
        }
        if (!empty($payload['rrule'])) {
            $lines[] = 'RRULE:' . strtoupper(sanitize_text_field((string) $payload['rrule']));
        }
        $lines[] = 'END:VEVENT';
    }

    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", $lines) . "\r\n";
}

function eventostri_calendar_build_google_url($payload) {
    if (!is_array($payload) || !isset($payload['start']) || !($payload['start'] instanceof DateTimeInterface)) {
        return '';
    }

    $start = eventostri_calendar_format_ics_datetime($payload['start']);
    $end = isset($payload['end']) && $payload['end'] instanceof DateTimeInterface
        ? eventostri_calendar_format_ics_datetime($payload['end'])
        : eventostri_calendar_format_ics_datetime(DateTimeImmutable::createFromInterface($payload['start'])->add(new DateInterval('PT120M')));

    $query = array(
        'action' => 'TEMPLATE',
        'text' => isset($payload['title']) ? $payload['title'] : '',
        'dates' => $start . '/' . $end,
        'details' => isset($payload['description']) ? $payload['description'] : '',
        'location' => isset($payload['location']) ? $payload['location'] : '',
        'ctz' => isset($payload['timezone']) ? $payload['timezone'] : 'UTC',
    );

    return esc_url_raw(add_query_arg($query, 'https://calendar.google.com/calendar/render'));
}

function eventostri_calendar_build_outlook_url($payload) {
    if (!is_array($payload) || !isset($payload['start']) || !($payload['start'] instanceof DateTimeInterface)) {
        return '';
    }

    $start_utc = DateTimeImmutable::createFromInterface($payload['start'])->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');
    $end_value = isset($payload['end']) && $payload['end'] instanceof DateTimeInterface
        ? $payload['end']
        : DateTimeImmutable::createFromInterface($payload['start'])->add(new DateInterval('PT120M'));
    $end_utc = DateTimeImmutable::createFromInterface($end_value)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');

    $query = array(
        'path' => '/calendar/action/compose',
        'rru' => 'addevent',
        'subject' => isset($payload['title']) ? $payload['title'] : '',
        'startdt' => $start_utc,
        'enddt' => $end_utc,
        'body' => isset($payload['description']) ? $payload['description'] : '',
        'location' => isset($payload['location']) ? $payload['location'] : '',
    );

    return esc_url_raw(add_query_arg($query, 'https://outlook.live.com/calendar/0/deeplink/compose'));
}

function eventostri_calendar_get_single_event_ics_url($post_id) {
    return esc_url_raw(rest_url('eventostri/v1/eventos/' . (int) $post_id . '/ics'));
}

function eventostri_calendar_get_feed_ics_url() {
    return esc_url_raw(rest_url('eventostri/v1/calendar/feed.ics'));
}

function eventostri_calendar_build_calendar_actions_for_post($post_id) {
    $payload = eventostri_calendar_build_export_payload($post_id);
    if (!$payload) {
        return array();
    }

    return array(
        'google_url' => eventostri_calendar_build_google_url($payload),
        'outlook_url' => eventostri_calendar_build_outlook_url($payload),
        'ics_url' => eventostri_calendar_get_single_event_ics_url($post_id),
    );
}

function eventostri_calendar_add_public_calendar_actions($event_data, $post_id) {
    if (!is_array($event_data)) {
        return $event_data;
    }

    $actions = eventostri_calendar_build_calendar_actions_for_post((int) $post_id);
    if (!empty($actions)) {
        $event_data['CalendarActions'] = $actions;
    }

    return $event_data;
}

function eventostri_rest_get_event_ics(WP_REST_Request $request) {
    $post_id = (int) $request['id'];
    $payload = eventostri_calendar_build_export_payload($post_id);
    if (!$payload) {
        return new WP_Error(
            'eventostri_ics_event_not_found',
            'Evento no encontrado o no visible para exportar.',
            array('status' => 404)
        );
    }

    $ics = eventostri_calendar_render_ics_event($payload);
    $filename = 'eventostri-evento-' . $post_id . '.ics';

    $response = new WP_REST_Response($ics, 200);
    $response->header('Content-Type', 'text/calendar; charset=utf-8');
    $response->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
    return $response;
}

function eventostri_rest_get_calendar_feed_ics() {
    $eventos = eventostri_calendar_get_public_events_cached_payload();
    $payloads = array();

    foreach ($eventos as $evento) {
        $post_id = isset($evento['id']) ? (int) $evento['id'] : 0;
        if ($post_id <= 0) {
            continue;
        }

        $payload = eventostri_calendar_build_export_payload($post_id);
        if ($payload) {
            $payloads[] = $payload;
        }
    }

    $ics = eventostri_calendar_render_ics_feed($payloads);
    $response = new WP_REST_Response($ics, 200);
    $response->header('Content-Type', 'text/calendar; charset=utf-8');
    $response->header('Content-Disposition', 'inline; filename="eventostri-calendar-feed.ics"');
    return $response;
}

function eventostri_calendar_register_integration_routes() {
    register_rest_route('eventostri/v1', '/eventos/(?P<id>\d+)/ics', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'eventostri_rest_get_event_ics',
        'permission_callback' => '__return_true',
    ));

    register_rest_route('eventostri/v1', '/calendar/feed.ics', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'eventostri_rest_get_calendar_feed_ics',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'eventostri_calendar_register_integration_routes');
