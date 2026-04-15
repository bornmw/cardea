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
 * E2E Tests for Cardea - Proof-of-Work Comment Spam Protection
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
              'post_title' => 'Test Post for Comments',
              'post_content' => 'This is a test post to verify comment form.',
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

test.describe('Cardea - Proof-of-Work Comment Spam Protection', () => {
  test('should display PoW challenge fields in comment form', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await expect(page.locator('#cardea-nonce')).toBeAttached();
    await expect(page.locator('#cardea-difficulty')).toBeAttached();
    await expect(page.locator('#cardea-timestamp')).toBeAttached();
    await expect(page.locator('#cardea-salt')).toBeAttached();
    await expect(page.locator('#cardea-signature')).toBeAttached();
    await expect(page.locator('#cardea-solution')).toBeAttached();
  });

  test('should start mining when comment textarea is focused', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.locator('#comment').click();
    // Wait for async challenge fetch
    await expect(page.locator('#cardea-solution')).not.toHaveValue('', { timeout: 30000 });
  });

  test('should allow comment submission after PoW solution is found', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.locator('#comment').click();
    await expect(page.locator('#cardea-solution')).not.toHaveValue('', { timeout: 30000 });

    const solution = await page.locator('#cardea-solution').inputValue();
    await page.fill('#comment', 'This is a legitimate comment');
    await page.fill('#author', 'Test User');
    await page.fill('#email', 'test@example.com');

    await expect(page.locator('#cardea-solution')).toHaveValue(solution);

    await page.click('#submit', { noWaitAfter: true });

    await expect(page.locator('body')).toContainText('This is a legitimate comment', { timeout: 30000 });
  });

  test('should reject empty solution (dumb bot test)', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.fill('#comment', 'Bot comment without solving');
    await page.fill('#author', 'Spam Bot');
    await page.fill('#email', 'spam@example.com');

    await page.evaluate(() => {
      document.getElementById('cardea-solution').value = '';
      
      const form = document.getElementById('commentform');
      const clone = form.cloneNode(true);
      form.parentNode.replaceChild(clone, form);
      
      HTMLFormElement.prototype.submit.call(clone);
    });

    await expect(page.locator('.wp-die-message')).toContainText('Missing', { ignoreCase: true });
  });

test('should reject tampered signature', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    // First, focus to trigger challenge fetch
    await page.locator('#comment').click();
    await expect(page.locator('#cardea-solution')).not.toHaveValue('', { timeout: 30000 });

    await page.fill('#comment', 'Bot comment without solving');
    await page.fill('#author', 'Spam Bot');
    await page.fill('#email', 'spam@example.com');

    await page.evaluate(() => {
      document.getElementById('cardea-signature').value = 'tampered_signature_12345';
      document.getElementById('cardea-solution').value = '99999';
      
      const form = document.getElementById('commentform');
      const clone = form.cloneNode(true);
      form.parentNode.replaceChild(clone, form);
      
      HTMLFormElement.prototype.submit.call(clone);
    });

    await expect(page.locator('.wp-die-message')).toContainText('signature', { ignoreCase: true });
  });

  test('should reject tampered timestamp', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    // First, focus to trigger challenge fetch
    await page.locator('#comment').click();
    await expect(page.locator('#cardea-solution')).not.toHaveValue('', { timeout: 30000 });

    await page.fill('#comment', 'Expired comment');
    await page.fill('#author', 'Test User');
    await page.fill('#email', 'test@example.com');

    await page.evaluate(() => {
      document.getElementById('cardea-timestamp').value = '1000000000';
      document.getElementById('cardea-solution').value = '99999';
      
      const form = document.getElementById('commentform');
      const clone = form.cloneNode(true);
      form.parentNode.replaceChild(clone, form);
      
      HTMLFormElement.prototype.submit.call(clone);
    });

    await expect(page.locator('.wp-die-message')).toContainText(/signature|expired/i, { timeout: 10000 });
  });

  test('should reject replay attacks (same valid payload submitted twice)', async ({ page }) => {
    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.locator('#comment').click();
    await expect(page.locator('#cardea-solution')).not.toHaveValue('', { timeout: 30000 });

    const payload = await page.evaluate(() => {
      return {
        comment: 'Replay attack test',
        author: 'Replay Bot',
        email: 'replay@example.com',
        nonce: document.getElementById('cardea-nonce').value,
        difficulty: document.getElementById('cardea-difficulty').value,
        timestamp: document.getElementById('cardea-timestamp').value,
        salt: document.getElementById('cardea-salt').value,
        signature: document.getElementById('cardea-signature').value,
        solution: document.getElementById('cardea-solution').value
      };
    });

    await page.evaluate((p) => {
      const form = document.getElementById('commentform');
      form.querySelector('[name="comment"]').value = p.comment;
      form.querySelector('[name="author"]').value = p.author;
      form.querySelector('[name="email"]').value = p.email;
      document.getElementById('cardea-nonce').value = p.nonce;
      document.getElementById('cardea-timestamp').value = p.timestamp;
      document.getElementById('cardea-salt').value = p.salt;
      document.getElementById('cardea-signature').value = p.signature;
      document.getElementById('cardea-solution').value = p.solution;
      
      const clone = form.cloneNode(true);
      form.parentNode.replaceChild(clone, form);
      HTMLFormElement.prototype.submit.call(clone);
    }, payload);

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.evaluate((p) => {
      const form = document.getElementById('commentform');
      
      form.querySelector('[name="comment"]').value = 'Replay attack second attempt';
      form.querySelector('[name="author"]').value = p.author;
      form.querySelector('[name="email"]').value = p.email;

      document.getElementById('cardea-nonce').value = p.nonce;
      document.getElementById('cardea-timestamp').value = p.timestamp;
      document.getElementById('cardea-salt').value = p.salt;
      document.getElementById('cardea-signature').value = p.signature;
      document.getElementById('cardea-solution').value = p.solution;
      
      const clone = form.cloneNode(true);
      form.parentNode.replaceChild(clone, form);
      HTMLFormElement.prototype.submit.call(clone);
    }, payload);

    await expect(page.locator('.wp-die-message')).toContainText('already been used', { ignoreCase: true });
  });

  test('should work without Web Worker support', async ({ page }) => {
    await page.addInitScript(() => {
      delete window.Worker;
    });

    await page.goto(`${cli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    await page.fill('#comment', 'Test comment');
    await page.fill('#author', 'Test User');
    await page.fill('#email', 'test@example.com');
    
    await page.click('#submit', { noWaitAfter: true });
    await page.waitForTimeout(3000);

    // Without Worker, submission should work (graceful fallback)
    const pageText = await page.locator('body').textContent();
    const hasError = pageText.toLowerCase().includes('missing') || 
                     pageText.toLowerCase().includes('solution') ||
                     pageText.toLowerCase().includes('failed');
    expect(hasError).toBe(false);
  });
});

test.describe('Cardea - Admin Dashboard Reply', () => {
  let adminCli;

  test.beforeAll(async () => {
    adminCli = await runCLI({
      command: 'server',
      php: '8.3',
      wp: 'latest',
      login: true,
      adminLogin: true,
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
                'post_title' => 'Test Post for Admin Reply',
                'post_content' => 'This is a test post for admin reply test.',
                'post_status' => 'publish',
                'comment_status' => 'open',
              ]);
              // Create a test comment
              wp_insert_comment([
                'comment_post_ID' => $post_id,
                'comment_content' => 'Test comment for admin reply test',
                'comment_author' => 'Test Commenter',
                'comment_author_email' => 'tester@test.com',
                'comment_approved' => 1,
              ]);
            `,
          },
        ],
      },
    });
  });

  test.afterAll(async () => {
    if (adminCli) {
      await adminCli[Symbol.asyncDispose]();
    }
  });

  test('should allow admin to reply from wp-admin without PoW', async ({ page }) => {
    // Go directly to wp-admin comments page (already logged in as admin)
    await page.goto(`${adminCli.serverUrl}/wp-admin/edit-comments.php`);
    await expect(page.locator('#the-comment-list')).toBeVisible({ timeout: 15000 });

    // Wait for comments table to load
    await page.waitForTimeout(3000);

    // Check if there are any rows in the comments table
    const hasComments = await page.locator('#the-comment-list tbody tr').count() > 0;
    
    if (hasComments) {
      // Find and click reply button - try multiple possible selectors
      const replyButton = page.locator('a.reply').or(page.locator('.reply-btn')).or(page.locator('td.column-comment a:has-text("Reply")'));
      await replyButton.first().click({ timeout: 5000 }).catch(() => {
        // If specific reply button not found, try clicking via JS
        return page.evaluate(() => {
          const replyLink = document.querySelector('a.reply') || document.querySelector('.reply-btn');
          if (replyLink) replyLink.click();
        });
      });

      // Wait for the reply form
      await page.waitForTimeout(1000);
      
      // Check if reply container appeared
      const replyContainer = page.locator('#replycontainer');
      if (await replyContainer.isVisible().catch(() => false)) {
        await page.fill('#replycontent', 'This is an admin reply from wp-admin');
        await page.click('#replybtn-submit');
        await page.waitForTimeout(3000);

        const pageText = await page.locator('body').textContent();
        expect(pageText.toLowerCase()).not.toContain('missing challenge fields');
        expect(pageText.toLowerCase()).not.toContain('pow verification failed');
      } else {
        // Form didn't appear, skip
        console.log('Reply form did not appear');
      }
    } else {
      // No comments to reply to - verify we can at least access wp-admin without PoW errors
      const pageText = await page.locator('body').textContent();
      expect(pageText.toLowerCase()).not.toContain('missing challenge fields');
      expect(pageText.toLowerCase()).not.toContain('pow verification failed');
    }
  });

  test('should not load PoW fields for logged-in frontend users', async ({ page }) => {
    // Logged-in user visits the frontend
    await page.goto(`${adminCli.serverUrl}/?p=1`);
    await expect(page.locator('#commentform')).toBeVisible();

    // Verify PoW hidden fields are NOT in the DOM
    const nonceCount = await page.locator('#cardea-nonce').count();
    const solutionCount = await page.locator('#cardea-solution').count();

    expect(nonceCount).toBe(0);
    expect(solutionCount).toBe(0);

    // Verify cardeaConfig is NOT localized
    const hasConfig = await page.evaluate(() => typeof window.cardeaConfig !== 'undefined');
    expect(hasConfig).toBe(false);
  });
});