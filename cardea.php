<?php
/**
 * Plugin Name:       Cardea - Proof-of-Work Comment Spam Protection
 * Plugin URI:        https://olegmikheev.com/cardea
 * Description:       Lightweight, zero-dependency Proof-of-Work anti-spam protection for WordPress comments. Uses client-side cryptographic mining to filter out automated spam.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Oleg Mikheev
 * Author URI:        https://olegmikheev.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       cardea
 *
 * @package           Cardea
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CARDEA_VERSION', '1.0.0' );
define( 'CARDEA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CARDEA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'CARDEA_DEFAULT_DIFFICULTY', 4 );
define( 'CARDEA_DEFAULT_WINDOW', 30 );

require_once CARDEA_PLUGIN_DIR . 'includes/class-cardea-core.php';
require_once CARDEA_PLUGIN_DIR . 'includes/class-cardea-frontend.php';
require_once CARDEA_PLUGIN_DIR . 'includes/class-cardea-admin.php';

/**
 * Initialize the plugin.
 *
 * @return void
 */
function cardea_init() {
	$core     = new Cardea_Core();
	$frontend = new Cardea_Frontend( $core );
	$admin    = new Cardea_Admin( $core );

	$core->init();
	$frontend->init();
	$admin->init();
}
add_action( 'plugins_loaded', 'cardea_init' );
