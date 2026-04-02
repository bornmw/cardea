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
 * E2E Tests for Cardea - REST API Comment Protection
 * 
 * Uses @wp-playground/cli to mount the local plugin directory
 * and run tests against WordPress Playground WASM.
 */

const { test, expect } = require('@playwright/test');
const { runCLI } = require('@wp-playground/cli');

let cli;

test.beforeAll(async () => {
  cli = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: false,
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
          data: '<?php add_filter("check_comment_flood", "__return_false", 999); add_filter("wp_is_comment_flood", "__return_false", 999); add_action("init", function() { remove_action("preprocess_comment", "wp_check_comment_flood_min_db"); }, 999);'
        },
        {
          step: 'runPHP',
          code: `<?php
            require '/wordpress/wp-load.php';
            $post_id = wp_insert_post([
              'post_title' => 'Test Post for REST API',
              'post_content' => 'This is a test post to verify REST API comments.',
              'post_status' => 'publish',
              'comment_status' => 'open',
            ]);
          `,
        },
      ],
    },
  });
});

test.afterAll(async () => {
  if (cli) {
    await cli[Symbol.asyncDispose]();
  }
});

test.describe('Cardea - REST API Comment Protection', () => {
  test('should allow authenticated REST API comments', async ({ request }) => {
    const response = await request.post(`${cli.serverUrl}/wp-json/wp/v2/comments`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:password').toString('base64')
      },
      data: {
        post: 1,
        content: 'This is a valid authenticated API comment.'
      }
    });

    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
  });

  test('should allow pingbacks via REST API', async ({ request }) => {
    const response = await request.post(`${cli.serverUrl}/wp-json/wp/v2/comments`, {
      data: {
        post: 1,
        author_name: 'Pingback Test',
        author_url: 'https://example.com',
        content: 'Test pingback',
        comment_type: 'pingback'
      }
    });

    const responseText = await response.text();
    expect(responseText.toLowerCase()).not.toContain('missing challenge fields');
  });
});
