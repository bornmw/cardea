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
 * Comment verification gate for Cardea.
 *
 * Thin transport adapters on top of the pure Cardea_Core verification
 * pipeline. The gate owns everything transport-specific - hook registration,
 * reading submission fields from HTTP forms and REST requests, and the
 * user-facing failure response - while Cardea_Core stays free of I/O.
 *
 * @package Cardea
 */

/**
 * Cardea_Comment_Gate class.
 *
 * @package Cardea
 */
class Cardea_Comment_Gate {

	/**
	 * Core instance.
	 *
	 * @var Cardea_Core
	 */
	private $core;

	/**
	 * Constructor.
	 *
	 * @param Cardea_Core $core Core instance.
	 */
	public function __construct( Cardea_Core $core ) {
		$this->core = $core;
	}

	/**
	 * Initialize hooks.
	 */
	public function init() {
		add_filter( 'preprocess_comment', array( $this, 'verify_form_submission' ) );
		add_filter( 'rest_pre_insert_comment', array( $this, 'verify_rest_submission' ), 10, 2 );
	}

	/**
	 * Verify a PoW on comment form submission.
	 *
	 * @param array $commentdata Comment data.
	 * @return array|WP_Error
	 */
	public function verify_form_submission( $commentdata ) {
		$comment_type = isset( $commentdata['comment_type'] ) ? $commentdata['comment_type'] : '';

		if ( $this->submission_is_exempt( $comment_type ) ) {
			return $commentdata;
		}

		/* phpcs:disable WordPress.Security.NonceVerification.Missing -- values are verified by wp_verify_nonce() in run_verification(). */
		$nonce     = isset( $_POST['cardea_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_nonce'] ) ) : '';
		$timestamp = isset( $_POST['cardea_timestamp'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_timestamp'] ) ) : '';
		$salt      = isset( $_POST['cardea_salt'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_salt'] ) ) : '';
		$solution  = isset( $_POST['cardea_solution'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_solution'] ) ) : '';
		$signature = isset( $_POST['cardea_signature'] ) ? sanitize_text_field( wp_unslash( $_POST['cardea_signature'] ) ) : '';
		/* phpcs:enable */

		if ( $this->run_verification( $nonce, $timestamp, $salt, $solution, $signature ) ) {
			return $commentdata;
		}

		$this->die_on_verification_failure();

		return $commentdata;
	}

	/**
	 * Verify a PoW on REST API comment submission.
	 *
	 * Anonymous submissions must provide the same challenge fields as the
	 * comment form and are verified by the identical pipeline.
	 *
	 * @param array           $prepared_comment Prepared comment data.
	 * @param WP_REST_Request $request          The request object.
	 * @return array|WP_Error
	 */
	public function verify_rest_submission( $prepared_comment, $request ) {
		$comment_type = $request->get_param( 'comment_type' ) ? $request->get_param( 'comment_type' ) : '';

		if ( $this->submission_is_exempt( $comment_type ) ) {
			return $prepared_comment;
		}

		$nonce     = $this->get_rest_param( $request, 'cardea_nonce' );
		$timestamp = $this->get_rest_param( $request, 'cardea_timestamp' );
		$salt      = $this->get_rest_param( $request, 'cardea_salt' );
		$solution  = $this->get_rest_param( $request, 'cardea_solution' );
		$signature = $this->get_rest_param( $request, 'cardea_signature' );

		if ( $this->run_verification( $nonce, $timestamp, $salt, $solution, $signature ) ) {
			return $prepared_comment;
		}

		/*
		 * One generic error for every failure mode: the client learns only that
		 * verification failed, never which check failed.
		 */
		return new WP_Error(
			'cardea_verification_failed',
			Cardea_Core::failure_message(),
			array( 'status' => 403 )
		);
	}

	/**
	 * Whether this submission is exempt from Proof-of-Work verification.
	 *
	 * Moderators, logged-in users, and non-comment types (pingbacks,
	 * trackbacks) are exempt.
	 *
	 * @param string $comment_type Comment type of the submission.
	 * @return bool
	 */
	private function submission_is_exempt( $comment_type ) {
		if ( current_user_can( 'moderate_comments' ) ) {
			return true;
		}

		if ( in_array( $comment_type, array( 'pingback', 'trackback' ), true ) ) {
			return true;
		}

		return is_user_logged_in();
	}

	/**
	 * Run the shared verification pipeline over parsed submission fields.
	 *
	 * @param string $nonce     Challenge nonce.
	 * @param string $timestamp Challenge timestamp.
	 * @param string $salt      Challenge salt.
	 * @param string $solution  Client solution.
	 * @param string $signature Challenge signature.
	 * @return bool True when the submission verifies.
	 */
	private function run_verification( $nonce, $timestamp, $salt, $solution, $signature ) {
		if ( empty( $nonce ) || empty( $timestamp ) || empty( $salt ) || empty( $solution ) ) {
			return false;
		}

		if ( ! wp_verify_nonce( $nonce, 'cardea_challenge' ) ) {
			return false;
		}

		$challenge = array(
			'nonce'      => $nonce,
			'timestamp'  => $timestamp,
			'salt'       => $salt,
			'signature'  => $signature,
			'difficulty' => $this->core->get_difficulty(),
		);

		return ! is_wp_error( $this->core->verify_solution( $challenge, $solution ) );
	}

	/**
	 * Read and sanitize a plugin parameter from a REST request.
	 *
	 * @param object $request The request object.
	 * @param string $param   Parameter name.
	 * @return string
	 */
	private function get_rest_param( $request, $param ) {
		$value = $request->get_param( $param );
		return sanitize_text_field( wp_unslash( is_scalar( $value ) ? (string) $value : '' ) );
	}

	/**
	 * Terminate the request with the generic verification failure message.
	 *
	 * @codeCoverageIgnore
	 */
	private function die_on_verification_failure() {
		wp_die(
			esc_html( Cardea_Core::failure_message() ),
			esc_html__( 'PoW Verification Failed', 'cardea' ),
			array( 'response' => 403 )
		);
	}
}
