<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package Cardea
 */

// If uninstall not called from WordPress, then exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// 1. Delete the static plugin options.
delete_option( 'cardea_difficulty' );
delete_option( 'cardea_time_window' );

// 2. Delete all replay-protection transients.
// Transients are stored in the wp_options table with specific prefixes.
global $wpdb;

// Replace 'cardea_used_' with whatever prefix you actually used in set_transient().
$transient_prefix = 'cardea_used_';

// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
		'_transient_' . $transient_prefix . '%',
		'_transient_timeout_' . $transient_prefix . '%'
	)
);
