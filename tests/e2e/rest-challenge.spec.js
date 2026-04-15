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
 * E2E Tests for Cardea - REST API Challenge Endpoint
 * 
 * Tests the dynamic challenge fetching that supports page caching.
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
          data: '<?php add_filter("check_comment_flood", "__return_false", 999); add_filter("wp_is_comment_flood", "__return_false", 999);'
        },
        {
          step: 'runPHP',
          code: `<?php
            require '/wordpress/wp-load.php';
            wp_insert_post([
              'post_title' => 'Test Post for REST Challenge',
              'post_content' => 'This is a test post.',
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

test.describe('Cardea - REST API Challenge Endpoint', () => {
  test('should return valid challenge via REST API', async ({ request }) => {
    const response = await request.get(`${cli.serverUrl}/wp-json/cardea/v1/challenge?post_id=1`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.nonce).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.salt).toBeDefined();
    expect(data.signature).toBeDefined();
    expect(data.difficulty).toBeDefined();
  });

  test('should work without post_id parameter', async ({ request }) => {
    const response = await request.get(`${cli.serverUrl}/wp-json/cardea/v1/challenge`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.nonce).toBeDefined();
    expect(data.difficulty).toBeDefined();
  });
});