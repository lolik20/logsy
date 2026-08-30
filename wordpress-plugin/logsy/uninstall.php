<?php
// Uninstall cleanup: the plugin stores exactly one option — remove it.

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'logsy_settings' );
