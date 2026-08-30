<?php
/**
 * Plugin Name:       Logsy – Uptime Monitoring, Error Logging, Session Replay & 152-FZ
 * Plugin URI:        https://logsy.ru/cms/wordpress
 * Description:       Connects your site to Logsy: uptime monitoring, JavaScript error logging, session replay and RU 152-FZ consent tools. Nothing is loaded until you enable it in settings.
 * Version:           1.0.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Logsy
 * Author URI:        https://logsy.ru
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       logsy
 */

// The plugin is a thin "serviceware" connector (directory guideline 6): all it does is
// embed the Logsy SDK script on public pages after the site owner explicitly enables it.
// No data is collected and no external requests are made until that switch is on
// (guideline 7 — informed consent). The SDK needs no API key: the Logsy project is
// matched by the request Origin, so the only setup is creating a project for this domain.

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LOGSY_VERSION', '1.0.0' );
define( 'LOGSY_SDK_URL', 'https://logsy.ru/api/logger/sdk' );
define( 'LOGSY_OPTION', 'logsy_settings' );

/**
 * Bundled translations: ru_RU ships inside the plugin's /languages folder.
 * Registering the folder with the textdomain registry lets just-in-time loading
 * pick the bundled files up; wordpress.org language packs, once they exist,
 * still take precedence. This is what load_plugin_textdomain() does internally
 * since WP 6.1, minus the parts deprecated in 4.6.
 */
function logsy_register_translations() {
	global $wp_textdomain_registry;
	if ( $wp_textdomain_registry instanceof WP_Textdomain_Registry ) {
		$wp_textdomain_registry->set_custom_path( 'logsy', __DIR__ . '/languages' );
	}
}
add_action( 'init', 'logsy_register_translations' );

/**
 * Settings with defaults. Master switch is OFF after install:
 * the plugin must stay silent until the owner turns it on.
 *
 * @return array{enabled: bool, hide_for_admins: bool}
 */
function logsy_get_settings() {
	$defaults = array(
		'enabled'         => false,
		'hide_for_admins' => true,
	);
	$saved = get_option( LOGSY_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

/**
 * Frontend only (wp_enqueue_scripts never fires in wp-admin): embed the SDK
 * once enabled. The plugin version goes into ?ver= — the SDK endpoint ignores
 * the query string, and the stable value keeps the URL CDN-cacheable.
 */
function logsy_enqueue_sdk() {
	$opts = logsy_get_settings();
	if ( empty( $opts['enabled'] ) ) {
		return;
	}
	if ( ! empty( $opts['hide_for_admins'] ) && current_user_can( 'manage_options' ) ) {
		return;
	}
	$src = apply_filters( 'logsy_sdk_url', LOGSY_SDK_URL );
	wp_enqueue_script(
		'logsy-sdk',
		esc_url_raw( $src ),
		array(),
		LOGSY_VERSION,
		array(
			'in_footer' => false,
			'strategy'  => 'async',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'logsy_enqueue_sdk' );

/** Register the option with a strict sanitizer: only two booleans are ever stored. */
function logsy_register_settings() {
	register_setting(
		'logsy',
		LOGSY_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'logsy_sanitize_settings',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'logsy_register_settings' );

/**
 * @param mixed $input Raw form input.
 * @return array Clean settings array.
 */
function logsy_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();
	return array(
		'enabled'         => ! empty( $input['enabled'] ),
		'hide_for_admins' => ! empty( $input['hide_for_admins'] ),
	);
}

/** Settings → Logsy. */
function logsy_admin_menu() {
	add_options_page(
		__( 'Logsy', 'logsy' ),
		__( 'Logsy', 'logsy' ),
		'manage_options',
		'logsy',
		'logsy_render_settings_page'
	);
}
add_action( 'admin_menu', 'logsy_admin_menu' );

/** "Settings" shortcut on the Plugins screen row. */
function logsy_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=logsy' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'logsy' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'logsy_action_links' );

/** Settings page: master switch, admin exclusion, and setup guidance. */
function logsy_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$opts = logsy_get_settings();
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Logsy', 'logsy' ); ?></h1>

		<p>
			<?php esc_html_e( 'Logsy adds uptime monitoring, JavaScript error logging, session replay and RU 152-FZ consent tools to your site through a single script.', 'logsy' ); ?>
		</p>
		<ol>
			<li>
				<?php
				printf(
					wp_kses(
						/* translators: 1: link to logsy.ru, 2: current site domain. */
						__( 'Create a free project at <a href="%1$s" target="_blank" rel="noopener">logsy.ru</a> for the domain <code>%2$s</code>. The script is matched to your project by domain, so no API key is needed.', 'logsy' ),
						array(
							'a'    => array(
								'href'   => array(),
								'target' => array(),
								'rel'    => array(),
							),
							'code' => array(),
						)
					),
					'https://logsy.ru/register',
					esc_html( $host )
				);
				?>
			</li>
			<li><?php esc_html_e( 'Enable the switch below — the monitoring script will be embedded on public pages.', 'logsy' ); ?></li>
			<li>
				<?php
				printf(
					wp_kses(
						/* translators: %s: link to the Logsy dashboard. */
						__( 'Open your <a href="%s" target="_blank" rel="noopener">Logsy dashboard</a> to see sessions, errors and monitoring results.', 'logsy' ),
						array(
							'a' => array(
								'href'   => array(),
								'target' => array(),
								'rel'    => array(),
							),
						)
					),
					'https://logsy.ru/dashboard'
				);
				?>
			</li>
		</ol>

		<form action="options.php" method="post">
			<?php settings_fields( 'logsy' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Monitoring script', 'logsy' ); ?></th>
					<td>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( LOGSY_OPTION ); ?>[enabled]" value="1" <?php checked( $opts['enabled'] ); ?> />
							<?php esc_html_e( 'Enable: embed the Logsy script on public pages', 'logsy' ); ?>
						</label>
						<p class="description">
							<?php esc_html_e( 'While disabled, the plugin makes no external requests and collects nothing.', 'logsy' ); ?>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Administrators', 'logsy' ); ?></th>
					<td>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( LOGSY_OPTION ); ?>[hide_for_admins]" value="1" <?php checked( $opts['hide_for_admins'] ); ?> />
							<?php esc_html_e( 'Do not load the script for logged-in administrators', 'logsy' ); ?>
						</label>
						<p class="description">
							<?php esc_html_e( 'Keeps your own visits out of session recordings and error logs.', 'logsy' ); ?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<p>
			<?php
			if ( $opts['enabled'] ) {
				esc_html_e( 'Status: the script is being embedded. If no data appears in the dashboard within a few minutes, check that your Logsy project domain matches this site.', 'logsy' );
			} else {
				esc_html_e( 'Status: disabled — the script is not embedded.', 'logsy' );
			}
			?>
		</p>

		<hr />
		<p class="description">
			<?php
			printf(
				wp_kses(
					/* translators: 1: privacy policy link, 2: terms link. */
					__( 'When enabled, the script sends technical data about visitor sessions (JavaScript errors, network requests, page views, and — if enabled in your project — session recordings and consent events including IP address) to Logsy servers. See the <a href="%1$s" target="_blank" rel="noopener">privacy policy</a> and <a href="%2$s" target="_blank" rel="noopener">terms of service</a>.', 'logsy' ),
					array(
						'a' => array(
							'href'   => array(),
							'target' => array(),
							'rel'    => array(),
						),
					)
				),
				'https://logsy.ru/privacy',
				'https://logsy.ru/offer'
			);
			?>
		</p>
	</div>
	<?php
}
