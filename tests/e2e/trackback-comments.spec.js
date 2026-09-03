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
 * E2E Tests for Cardea - Trackback/Pingback Protection
 * 
 * Uses @wp-playground/cli to mount the local plugin directory
 * and run tests against WordPress Playground WASM.
 */

const { test, expect } = require('@playwright/test');
const { startPlayground } = require('./support/playground');

let cli;

test.beforeAll(async () => {
    cli = await startPlayground( { postTitle: 'Test Post for Trackbacks' });
});

test.afterAll(async () => {
  if (cli) {
    await cli[Symbol.asyncDispose]();
  }
});

test.describe('Cardea - Trackback/Pingback Protection', () => {
  test('should allow valid trackbacks to bypass PoW', async ({ request }) => {
    const response = await request.post(`${cli.serverUrl}/wp-trackback.php/1`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        url: 'https://another-blog.com/my-post',
        title: 'Linking to your article',
        blog_name: 'Another Tech Blog',
        excerpt: 'I found this article very interesting...'
      }).toString()
    });

    const responseBody = await response.text();
    expect(responseBody).not.toContain('could not be verified');
  });

  test('should allow pingbacks to bypass PoW', async ({ request }) => {
    const response = await request.post(`${cli.serverUrl}/xmlrpc.php`, {
      headers: { 'Content-Type': 'text/xml' },
      data: `<?xml version="1.0"?>
<methodCall>
  <methodName>pingback.ping</methodName>
  <params>
    <param><value><string>https://another-blog.com/my-post</string></value></param>
    <param><value><string>${cli.serverUrl}/?p=1</string></value></param>
  </params>
</methodCall>`
    });

    const responseBody = await response.text();
    expect(responseBody).not.toContain('could not be verified');
  });
});
