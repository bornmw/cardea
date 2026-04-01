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

/**
 * Admin settings page for Cardea PoW configuration.
 *
 * @package Cardea
 */

/**
 * Cardea_Admin class.
 *
 * @package Cardea
 */
class Cardea_Admin {

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
	 * Initialize admin hooks.
	 */
	public function init() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	/**
	 * Add settings page.
	 */
	public function add_settings_page() {
		add_options_page(
			__( 'Cardea PoW Protection', 'cardea' ),
			__( 'Cardea PoW', 'cardea' ),
			'manage_options',
			'cardea-settings',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register settings.
	 */
	public function register_settings() {
		register_setting(
			'cardea_settings',
			Cardea_Core::OPTION_DIFFICULTY,
			array(
				'type'              => 'integer',
				'sanitize_callback' => array( $this, 'sanitize_difficulty' ),
				'default'           => CARDEA_DEFAULT_DIFFICULTY,
			)
		);

		register_setting(
			'cardea_settings',
			Cardea_Core::OPTION_TIME_WINDOW,
			array(
				'type'              => 'integer',
				'sanitize_callback' => array( $this, 'sanitize_time_window' ),
				'default'           => CARDEA_DEFAULT_WINDOW,
			)
		);

		add_settings_section(
			'cardea_main_section',
			__( 'Proof-of-Work Settings', 'cardea' ),
			array( $this, 'render_section_description' ),
			'cardea_settings'
		);

		add_settings_field(
			'cardea_difficulty',
			__( 'Difficulty Level', 'cardea' ),
			array( $this, 'render_difficulty_field' ),
			'cardea_settings',
			'cardea_main_section'
		);

		add_settings_field(
			'cardea_time_window',
			__( 'Time Window (minutes)', 'cardea' ),
			array( $this, 'render_time_window_field' ),
			'cardea_settings',
			'cardea_main_section'
		);
	}

	/**
	 * Sanitize difficulty value.
	 *
	 * @param mixed $value Input value.
	 * @return int
	 */
	public function sanitize_difficulty( $value ) {
		$value = (int) $value;
		return max( 1, min( 8, $value ) );
	}

	/**
	 * Sanitize time window value.
	 *
	 * @param mixed $value Input value.
	 * @return int
	 */
	public function sanitize_time_window( $value ) {
		$value = (int) $value;
		return max( 5, min( 120, $value ) );
	}

	/**
	 * Render section description.
	 */
	public function render_section_description() {
		echo '<p>' . esc_html__( 'Configure the Proof-of-Work challenge settings. Higher difficulty means more work for spammers but slightly more CPU usage for legitimate commenters.', 'cardea' ) . '</p>';
	}

	/**
	 * Render difficulty field.
	 */
	public function render_difficulty_field() {
		$difficulty = $this->core->get_difficulty();
		?>
		<input type="number"
			name="cardea_difficulty"
			id="cardea-difficulty"
			value="<?php echo esc_attr( $difficulty ); ?>"
			min="1"
			max="8"
			class="small-text" />
		<p class="description">
			<?php
			esc_html_e(
				'Number of leading zeros required in the hash. Recommended: 3-5. Higher values provide stronger protection but require more computation.',
				'cardea'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render time window field.
	 */
	public function render_time_window_field() {
		$time_window = $this->core->get_time_window();
		?>
		<input type="number"
			name="cardea_time_window"
			id="cardea-time-window"
			value="<?php echo esc_attr( $time_window ); ?>"
			min="5"
			max="120"
			class="small-text" />
		<p class="description">
			<?php
			esc_html_e(
				'How long the challenge remains valid (in minutes). After this time, the commenter must refresh to get a new challenge.',
				'cardea'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render the settings page.
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html__( 'Cardea PoW Protection Settings', 'cardea' ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'cardea_settings' );
				do_settings_sections( 'cardea_settings' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}
}
