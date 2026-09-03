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
const crypto = require('crypto');

/**
 * Solve the PoW challenge locally (mirrors the client, used to feed the REST parity tests).
 *
 * @param {Object} challenge Challenge object from the REST endpoint.
 * @returns {string} The solution (counter).
 */
function solveChallenge(challenge) {
  const challengeString = challenge.nonce + '|' + challenge.timestamp + '|' + challenge.salt;
  const prefix = '0'.repeat(challenge.difficulty);
  let counter = 0;
  for (;;) {
    const hash = crypto.createHash('sha256').update(challengeString + counter).digest('hex');
    if (hash.startsWith(prefix)) {
      return counter.toString();
    }
    counter++;
    if (counter > 5000000) {
      throw new Error('Did not find a solution in time');
    }
  }
}

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

  test('anonymous REST API comments are rejected by WordPress core', async ({ request }) => {
    // WordPress core requires login for anonymous comment creation via the
    // REST API (rest_comment_login_required), before any Cardea check runs.
    const response = await request.post(`${cli.serverUrl}/wp-json/wp/v2/comments`, {
      data: {
        post: 1,
        author_name: 'Anonymous',
        author_email: 'anon@example.com',
        content: 'Anonymous comment without challenge fields.'
      }
    });

    expect(response.status()).toBe(401);
    const body = await response.text();
    expect(body).toContain('rest_comment_login_required');
  });

  test('a valid PoW solution does not bypass the core login requirement', async ({ request }) => {
    // Defense in depth: Cardea's own rest_pre_insert_comment gate applies the
    // same PoW pipeline to any anonymous REST comment creation that core
    // allows. Today core blocks it with 401 first; if core ever changes that
    // policy, this test forces an explicit decision instead of a silent gap.
    const challengeResponse = await request.get(`${cli.serverUrl}/wp-json/cardea/v1/challenge?post_id=1`);
    expect(challengeResponse.status()).toBe(200);
    const challenge = await challengeResponse.json();
    const solution = solveChallenge(challenge);

    const response = await request.post(`${cli.serverUrl}/wp-json/wp/v2/comments`, {
      data: {
        post: 1,
        author_name: 'REST PoW User',
        author_email: 'rest-pow@example.com',
        content: 'Anonymous comment with a valid PoW solution.',
        cardea_nonce: challenge.nonce,
        cardea_timestamp: String(challenge.timestamp),
        cardea_salt: challenge.salt,
        cardea_solution: solution,
        cardea_signature: challenge.signature
      }
    });

    expect(response.status()).toBe(401);
    const body = await response.text();
    expect(body).toContain('rest_comment_login_required');
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
    expect(responseText.toLowerCase()).not.toContain('could not be verified');
  });
});
