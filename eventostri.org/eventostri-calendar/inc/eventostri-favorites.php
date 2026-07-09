<?php
if (!defined('ABSPATH')) {
    exit;
}

function eventostri_favorites_user_meta_key() {
    return 'eventostri_favorite_events';
}

function eventostri_favorites_normalize_ids($value) {
    if (!is_array($value)) {
        return array();
    }

    $candidate_ids = array_values(array_unique(array_filter(array_map(function($item) {
        return (int) $item;
    }, $value), function($id) {
        return $id > 0;
    })));

    if (empty($candidate_ids)) {
        return array();
    }

    $existing_ids = get_posts(array(
        'post_type' => 'eventostri_evento',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'post__in' => $candidate_ids,
        'orderby' => 'post__in',
        'no_found_rows' => true,
    ));

    $existing_set = array_fill_keys(array_map('intval', $existing_ids), true);
    $normalized = array();
    foreach ($candidate_ids as $id) {
        if (isset($existing_set[$id])) {
            $normalized[] = (int) $id;
        }
    }

    return $normalized;
}

function eventostri_favorites_get_user_ids($user_id) {
    $raw = get_user_meta((int) $user_id, eventostri_favorites_user_meta_key(), true);
    if (!is_array($raw)) {
        $raw = array();
    }

    $normalized = eventostri_favorites_normalize_ids($raw);

    // Keep stored user meta clean from stale or invalid IDs.
    if ($normalized !== $raw) {
        update_user_meta((int) $user_id, eventostri_favorites_user_meta_key(), $normalized);
    }

    return $normalized;
}

function eventostri_favorites_set_user_ids($user_id, $ids) {
    $normalized = eventostri_favorites_normalize_ids($ids);
    update_user_meta((int) $user_id, eventostri_favorites_user_meta_key(), $normalized);
    return $normalized;
}

function eventostri_rest_favorites_permission_check() {
    return is_user_logged_in();
}

function eventostri_rest_get_favorites() {
    $user = wp_get_current_user();
    $favorites = eventostri_favorites_get_user_ids($user->ID);

    return rest_ensure_response(array(
        'ok' => true,
        'favorites' => $favorites,
        'user' => array(
            'id' => (int) $user->ID,
            'name' => (string) $user->display_name,
        ),
    ));
}

function eventostri_rest_toggle_favorite(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        $payload = array();
    }

    $event_id = isset($payload['event_id']) ? (int) $payload['event_id'] : 0;
    if ($event_id <= 0) {
        return new WP_Error(
            'eventostri_favorites_invalid_event_id',
            'Debes enviar un event_id valido.',
            array('status' => 400)
        );
    }

    $favorites = eventostri_favorites_get_user_ids(get_current_user_id());
    $already_favorite = in_array($event_id, $favorites, true);

    if ($already_favorite) {
        $favorites = array_values(array_filter($favorites, function($id) use ($event_id) {
            return (int) $id !== $event_id;
        }));
    } else {
        $favorites[] = $event_id;
    }

    $stored = eventostri_favorites_set_user_ids(get_current_user_id(), $favorites);

    return rest_ensure_response(array(
        'ok' => true,
        'event_id' => $event_id,
        'is_favorite' => in_array($event_id, $stored, true),
        'favorites' => $stored,
    ));
}

function eventostri_rest_merge_favorites(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        $payload = array();
    }

    $local_ids = isset($payload['event_ids']) && is_array($payload['event_ids'])
        ? $payload['event_ids']
        : array();

    $server_ids = eventostri_favorites_get_user_ids(get_current_user_id());
    $merged = array_values(array_unique(array_merge($server_ids, array_map('intval', $local_ids))));
    $stored = eventostri_favorites_set_user_ids(get_current_user_id(), $merged);

    return rest_ensure_response(array(
        'ok' => true,
        'favorites' => $stored,
        'merged_count' => count($stored),
    ));
}

