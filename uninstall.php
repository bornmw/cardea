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

// 1. Delete the plugin options (difficulty, time window, replay store).
delete_option( 'cardea_difficulty' );
delete_option( 'cardea_time_window' );
delete_option( 'cardea_used' );

// 2. Delete all legacy replay-protection transients.
// Older versions stored one transient per used signature; those keys are
// still swept so uninstalling after an upgrade leaves no residue.
global $wpdb;

// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
		'_transient_cardea_used_%',
		'_transient_timeout_cardea_used_%'
	)
);
