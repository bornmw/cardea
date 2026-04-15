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
 * Frontend integration for displaying Cardea PoW challenge in comment form.
 *
 * @package Cardea
 */

/**
 * Cardea_Frontend class.
 *
 * @package Cardea
 */
class Cardea_Frontend {

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
	 * Initialize frontend hooks.
	 */
	public function init() {
		add_action( 'comment_form_after_fields', array( $this, 'render_pow_fields' ) );
		add_action( 'comment_form_logged_in_after', array( $this, 'render_pow_fields' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue frontend JavaScript and worker script.
	 */
	public function enqueue_scripts() {
		if ( ! is_singular() || ! comments_open() ) {
			return;
		}

		wp_enqueue_script(
			'cardea-frontend',
			CARDEA_PLUGIN_URL . 'assets/js/frontend.js',
			array(),
			CARDEA_VERSION,
			true
		);

		wp_localize_script(
			'cardea-frontend',
			'cardeaConfig',
			array(
				'workerUrl' => CARDEA_PLUGIN_URL . 'assets/js/pow-worker.js',
				'i18n'      => array(
					'verifying' => __( 'Verifying...', 'cardea' ),
					'solved'    => __( 'Solved!', 'cardea' ),
				),
			)
		);
	}

	/**
	 * Render the PoW hidden fields in the comment form.
	 */
	public function render_pow_fields() {
		if ( ! is_singular() || ! comments_open() ) {
			return;
		}

		$post_id   = get_the_ID();
		$challenge = $this->core->generate_challenge( $post_id );
		?>
		<input type="hidden" name="cardea_nonce" id="cardea-nonce" value="<?php echo esc_attr( $challenge['nonce'] ); ?>" />
		<input type="hidden" name="cardea_difficulty" id="cardea-difficulty" value="<?php echo esc_attr( $challenge['difficulty'] ); ?>" />
		<input type="hidden" name="cardea_timestamp" id="cardea-timestamp" value="<?php echo esc_attr( $challenge['timestamp'] ); ?>" />
		<input type="hidden" name="cardea_salt" id="cardea-salt" value="<?php echo esc_attr( $challenge['salt'] ); ?>" />
		<input type="hidden" name="cardea_signature" id="cardea-signature" value="<?php echo esc_attr( $challenge['signature'] ); ?>" />
		<input type="hidden" name="cardea_solution" id="cardea-solution" value="" />
		<?php
	}
}