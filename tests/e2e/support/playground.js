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
 * Shared Playwright / WordPress Playground fixtures for the Cardea e2e suite.
 *
 * Every spec boots WordPress through @wp-playground/cli with the plugin
 * mounted and activated. This helper is the single place that controls
 * the WordPress version under test, so any release line can be exercised:
 *
 *   WP_VERSION=7.0 make test-e2e
 */

const { runCLI } = require('@wp-playground/cli');

/** WordPress version under test (defaults to the latest stable release). */
const WP_VERSION = process.env.WP_VERSION || 'latest';

/** Disables the comment flood checks so rapid e2e submissions are not rate-limited. */
const FLOOD_CHECK_BYPASS = '<?php add_filter("check_comment_flood", "__return_false", 999); add_filter("wp_is_comment_flood", "__return_false", 999); add_action("init", function() { remove_action("preprocess_comment", "wp_check_comment_flood_min_db"); }, 999);';

/**
 * Boot a WordPress Playground server with the Cardea plugin mounted and
 * activated, plus a fresh open post.
 *
 * @param {Object}   [options]              Options.
 * @param {boolean}  [options.login=false]  Start with a logged-in admin session.
 * @param {string}   [options.postTitle]    Title of the auto-created open post.
 * @param {string}   [options.extraRunPHP]  Extra PHP executed after the post is created.
 * @returns {Promise<Object>} The running CLI handle ({ serverUrl, [Symbol.asyncDispose] }).
 */
async function startPlayground({ login = false, postTitle = 'Test Post', extraRunPHP = '' } = {}) {
  const options = {
    command: 'server',
    php: '8.3',
    wp: WP_VERSION,
    login: login,
    mount: [
      {
        hostPath: './',
        vfsPath: '/wordpress/wp-content/plugins/cardea',
      },
    ],
    blueprint: {
      steps: [
        {
          step: 'activatePlugin',
          pluginPath: '/wordpress/wp-content/plugins/cardea/cardea.php',
        },
        {
          step: 'writeFile',
          path: '/wordpress/wp-content/mu-plugins/disable-flood-check.php',
          data: FLOOD_CHECK_BYPASS,
        },
        {
          step: 'runPHP',
          code: `<?php
            require '/wordpress/wp-load.php';
            $post_id = wp_insert_post([
              'post_title' => '${postTitle}',
              'post_content' => 'This is a test post.',
              'post_status' => 'publish',
              'comment_status' => 'open',
            ]);
            ${extraRunPHP}
          `,
        },
      ],
    },
  };
  if (login) {
    options.adminLogin = true;
  }

  return runCLI(options);
}

module.exports = { startPlayground, WP_VERSION };
