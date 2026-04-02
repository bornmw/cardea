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
 * E2E Tests for Cardea - XML-RPC Comment Protection
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
            wp_insert_post([
              'post_title' => 'Test Post for XML-RPC',
              'post_content' => 'This is a test post to verify XML-RPC comments.',
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

test.describe('Cardea - XML-RPC Comment Protection', () => {
  test('should block XML-RPC comment submissions', async ({ request }) => {
    const xmlPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.newComment</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>admin</string></value></param>
    <param><value><string>password</string></value></param>
    <param><value><int>1</int></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>content</name>
            <value><string>XML-RPC spam attack</string></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

    const response = await request.post(`${cli.serverUrl}/xmlrpc.php`, {
      headers: { 'Content-Type': 'text/xml' },
      data: xmlPayload
    });

    const responseBody = await response.text();
    // Either our error or WordPress's error means it's blocked
    const isBlocked = responseBody.toLowerCase().includes('missing challenge fields') ||
                      responseBody.toLowerCase().includes('accepts post requests only') ||
                      response.status() !== 200;
    expect(isBlocked).toBe(true);
  });

  test('should allow XML-RPC pingbacks to bypass PoW', async ({ request }) => {
    const xmlPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>pingback.ping</methodName>
  <params>
    <param><value><string>https://attacker.com/post</string></value></param>
    <param><value><string>https://victim.com/post/1</string></value></param>
  </params>
</methodCall>`;

    const response = await request.post(`${cli.serverUrl}/xmlrpc.php`, {
      headers: { 'Content-Type': 'text/xml' },
      data: xmlPayload
    });

    const responseBody = await response.text();
    expect(responseBody.toLowerCase()).not.toContain('missing challenge fields');
  });
});
