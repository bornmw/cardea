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
 */

/**
 * Core logic for Cardea PoW challenge generation and verification.
 *
 * Uses stateless HMAC signature for challenge generation - zero database writes on page load.
 * Database writes only occur on successful comment submission to prevent replay attacks.
 *
 * Architecture:
 * - Page load: Generate HMAC-signed challenge (no DB write)
 * - Comment submit: Verify signature + PoW solution, then store transient (DB write)
 * - Replay prevention: Check transient before accepting, auto-expire via WordPress cron
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
				__( 'Missing challenge or solution fields.', 'cardea' )
			);
		}

		if ( ! $this->verify_signature( $challenge ) ) {
			return new WP_Error(
				'cardea_invalid_signature',
				__( 'Challenge signature verification failed.', 'cardea' )
			);
		}

		$timestamp   = (int) $challenge['timestamp'];
		$time_window = $this->get_time_window() * 60;

		if ( time() - $timestamp > $time_window ) {
			return new WP_Error(
				'cardea_expired',
				__( 'Challenge has expired. Please refresh the page and try again.', 'cardea' )
			);
		}

		$used_key = 'cardea_used_' . $challenge['signature'];
		if ( get_transient( $used_key ) ) {
			return new WP_Error(
				'cardea_replay',
				__( 'This challenge has already been used.', 'cardea' )
			);
		}

		$challenge_string = $this->build_challenge_string( $challenge );
		$hash             = hash( 'sha256', $challenge_string . $solution );

		if ( ! $this->hash_meets_difficulty( $hash, $challenge['difficulty'] ) ) {
			return new WP_Error(
				'cardea_invalid',
				__( 'Proof-of-Work verification failed.', 'cardea' )
			);
		}

		set_transient( $used_key, true, $time_window );

		return true;
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
	 */
	public function init() {
		add_action( 'preprocess_comment', array( $this, 'verify_comment_pow' ) );
	}

	/**
	 * Verify PoW on comment submission.
	 *
	 * @param array $commentdata Comment data.
	 * @return array|WP_Error
	 */
	public function verify_comment_pow( $commentdata ) {
		$nonce     = isset( $_POST['cardea_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_nonce'] ) ) : '';
		$timestamp = isset( $_POST['cardea_timestamp'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_timestamp'] ) ) : '';
		$salt      = isset( $_POST['cardea_salt'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_salt'] ) ) : '';
		$solution  = isset( $_POST['cardea_solution'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_solution'] ) ) : '';
		$signature = isset( $_POST['cardea_signature'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_signature'] ) ) : '';

		if ( empty( $nonce ) || empty( $timestamp ) || empty( $salt ) || empty( $solution ) ) {
			wp_die(
				esc_html__( 'Missing challenge fields.', 'cardea' ),
				esc_html__( 'PoW Verification Failed', 'cardea' ),
				array( 'response' => 403 )
			);
		}

		if ( ! wp_verify_nonce( $nonce, 'cardea_challenge' ) ) {
			wp_die(
				esc_html__( 'Security check failed.', 'cardea' ),
				esc_html__( 'PoW Verification Failed', 'cardea' ),
				array( 'response' => 403 )
			);
		}

		$challenge = array(
			'nonce'      => $nonce,
			'timestamp'  => $timestamp,
			'salt'       => $salt,
			'signature'  => $signature,
			'difficulty' => (int) get_option( self::OPTION_DIFFICULTY, CARDEA_DEFAULT_DIFFICULTY ),
		);

		$result = $this->verify_solution( $challenge, $solution );

		if ( is_wp_error( $result ) ) {
			wp_die(
				esc_html( $result->get_error_message() ),
				esc_html__( 'PoW Verification Failed', 'cardea' ),
				array( 'response' => 403 )
			);
		}

		return $commentdata;
	}
}
