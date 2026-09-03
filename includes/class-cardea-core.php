<?php
/**
 * Cardea - Proof-of-Work Comment Spam Protection
 *
 * Copyright (C) 2024 Oleg Mikheev
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * @package Cardea
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core logic for Cardea PoW challenge generation and verification.
 *
 * Uses stateless HMAC signature for challenge generation - zero database writes on page load.
 * Database writes only occur on successful comment submission to prevent replay attacks.
 *
 * Architecture:
 * - Page load: Generate HMAC-signed challenge (no DB write)
 * - Comment submit: Verify signature + PoW solution, then record the used signature (DB write)
 * - Replay prevention: Capped, self-pruning store of used signatures checked before accepting
 *
 * @package Cardea
 */

/**
 * Cardea_Core class.
 *
 * @package Cardea
 */
class Cardea_Core {

	const OPTION_DIFFICULTY  = 'cardea_difficulty';
	const OPTION_TIME_WINDOW = 'cardea_time_window';

	/**
	 * Option name of the replay store (used signatures).
	 */
	const USED_OPTION = 'cardea_used';

	/**
	 * Maximum number of stored used signatures (self-pruning cap).
	 */
	const USED_STORE_CAPACITY = 1024;

	/**
	 * User-facing verification failure message.
	 *
	 * One generic message for every failure mode: it stays actionable for
	 * legitimate users (refresh and retry) without revealing which check
	 * failed, so it cannot be used as an attack oracle.
	 *
	 * @return string Localized message.
	 */
	public static function failure_message() {
		return __( 'Your comment could not be verified. Please refresh the page and try again.', 'cardea' );
	}

	/**
	 * Get the difficulty level (number of leading zeros required).
	 *
	 * @return int
	 */
	public function get_difficulty() {
		$difficulty = (int) get_option( self::OPTION_DIFFICULTY, CARDEA_DEFAULT_DIFFICULTY );
		return (int) apply_filters( 'cardea_difficulty', $difficulty );
	}

	/**
	 * Get the time window for challenge validity in minutes.
	 *
	 * @return int
	 */
	public function get_time_window() {
		return (int) get_option( self::OPTION_TIME_WINDOW, CARDEA_DEFAULT_WINDOW );
	}

	/**
	 * Generate a new PoW challenge with HMAC signature.
	 *
	 * @param int $post_id Optional post ID for additional entropy.
	 * @return array Challenge data with nonce, timestamp, salt, difficulty, and signature.
	 */
	public function generate_challenge( $post_id = 0 ) {
		$nonce      = wp_create_nonce( 'cardea_challenge' );
		$timestamp  = time();
		$salt       = $this->generate_salt();
		$difficulty = $this->get_difficulty();

		$challenge = array(
			'nonce'      => $nonce,
			'timestamp'  => $timestamp,
			'salt'       => $salt,
			'difficulty' => $difficulty,
			'post_id'    => $post_id,
		);

		$challenge['signature'] = $this->generate_signature( $challenge );

		return $challenge;
	}

	/**
	 * Generate HMAC signature for challenge.
	 *
	 * @param array $challenge Challenge data.
	 * @return string
	 */
	public function generate_signature( $challenge ) {
		$string_to_sign = $challenge['nonce'] . '|' . $challenge['timestamp'] . '|' . $challenge['salt'];
		return hash_hmac( 'sha256', $string_to_sign, wp_salt( 'nonce' ) );
	}

	/**
	 * Verify HMAC signature.
	 *
	 * @param array $challenge Challenge data with signature.
	 * @return bool
	 */
	public function verify_signature( $challenge ) {
		$expected = $this->generate_signature( $challenge );
		return hash_equals( $expected, $challenge['signature'] );
	}

	/**
	 * Build a deterministic challenge string from challenge data.
	 *
	 * @param array $challenge Challenge data.
	 * @return string
	 */
	public function build_challenge_string( $challenge ) {
		return $challenge['nonce'] . '|' . $challenge['timestamp'] . '|' . $challenge['salt'];
	}

	/**
	 * Generate a random salt.
	 *
	 * @return string
	 */
	private function generate_salt() {
		return bin2hex( random_bytes( 16 ) );
	}

	/**
	 * Verify a PoW solution.
	 *
	 * @param array  $challenge Challenge data from POST.
	 * @param string $solution   The client-provided solution (counter).
	 * @return true|WP_Error True on success, WP_Error on failure.
	 */
	public function verify_solution( $challenge, $solution ) {
		if ( empty( $challenge['nonce'] ) || empty( $solution ) ) {
			return new WP_Error(
				'cardea_missing_fields',
				self::failure_message()
			);
		}

		if ( ! $this->verify_signature( $challenge ) ) {
			return new WP_Error(
				'cardea_invalid_signature',
				self::failure_message()
			);
		}

		$timestamp   = (int) $challenge['timestamp'];
		$time_window = $this->get_time_window() * 60;

		if ( time() - $timestamp > $time_window ) {
			return new WP_Error(
				'cardea_expired',
				self::failure_message()
			);
		}

		if ( $this->signature_is_used( $challenge['signature'] ) ) {
			return new WP_Error(
				'cardea_replay',
				self::failure_message()
			);
		}

		$challenge_string = $this->build_challenge_string( $challenge );
		$hash             = hash( 'sha256', $challenge_string . $solution );

		if ( ! $this->hash_meets_difficulty( $hash, $challenge['difficulty'] ) ) {
			return new WP_Error(
				'cardea_invalid',
				self::failure_message()
			);
		}

		$this->record_used_signature( $challenge['signature'], $time_window );

		return true;
	}

	/**
	 * Whether a challenge signature was already used within its validity window.
	 *
	 * @param string $signature Challenge signature.
	 * @return bool
	 */
	public function signature_is_used( $signature ) {
		$now = time();

		foreach ( $this->get_used_store()['signatures'] as $entry ) {
			if ( $entry['signature'] === $signature ) {
				return $now - $entry['time'] < $entry['window'];
			}
		}

		return false;
	}

	/**
	 * Record a used signature in the replay store.
	 *
	 * Expired entries are pruned on write and the store is capped so the
	 * option size stays bounded under any load.
	 *
	 * @param string $signature   Challenge signature.
	 * @param int    $time_window Validity window in seconds at record time.
	 * @return void
	 */
	public function record_used_signature( $signature, $time_window ) {
		$store = $this->get_used_store();
		$now   = time();

		$store['signatures'] = array_values(
			array_filter(
				$store['signatures'],
				static function ( $entry ) use ( $now ) {
					return $now - $entry['time'] < $entry['window'];
				}
			)
		);

		$store['signatures'][] = array(
			'signature' => $signature,
			'time'      => $now,
			'window'    => $time_window,
		);

		if ( count( $store['signatures'] ) > self::USED_STORE_CAPACITY ) {
			$store['signatures'] = array_slice( $store['signatures'], - self::USED_STORE_CAPACITY );
		}

		update_option( self::USED_OPTION, $store, false );
	}

	/**
	 * Fetch the replay store (used signatures).
	 *
	 * @return array
	 */
	public function get_used_store() {
		$store = get_option( self::USED_OPTION, array() );

		if ( ! is_array( $store ) || ! isset( $store['signatures'] ) || ! is_array( $store['signatures'] ) ) {
			$store = array( 'signatures' => array() );
		}

		return $store;
	}

	/**
	 * Check if a hash meets the difficulty requirement.
	 *
	 * @param string $hash       The hash to check.
	 * @param int    $difficulty Number of leading zeros required.
	 * @return bool
	 */
	public function hash_meets_difficulty( $hash, $difficulty ) {
		$prefix = str_repeat( '0', $difficulty );
		return strpos( $hash, $prefix ) === 0;
	}

	/**
	 * Initialize the plugin.
	 *
	 * Comment verification hooks are owned by Cardea_Comment_Gate.
	 */
	public function init() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	/**
	 * Register REST API route for fetching challenges.
	 */
	public function register_rest_routes() {
		register_rest_route(
			'cardea/v1',
			'/challenge',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'rest_get_challenge' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * REST API callback to generate a fresh challenge.
	 *
	 * @param object $request The request object.
	 * @return array
	 */
	public function rest_get_challenge( $request ) {
		$post_id = $request->get_param( 'post_id' ) ? (int) $request->get_param( 'post_id' ) : 0;
		return $this->generate_challenge( $post_id );
	}
}
