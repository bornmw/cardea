=== Cardea - Proof-of-Work Comment Spam Protection ===
Contributors: omikheev
Tags: comments, spam, protection, proof-of-work, anti-spam
Requires at least: 6.0
Requires PHP: 7.4
Tested up to: 6.9
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lightweight, zero-dependency Proof-of-Work anti-spam protection for WordPress comments.

== Description ==

Cardea is a lightweight WordPress plugin that protects your comment form from automated spam using cryptographic Proof-of-Work (PoW) challenges. The plugin requires no external APIs, no third-party services, and has zero dependencies beyond WordPress core.

=== How It Works ===

1. **Challenge Generation**: When a page with a comment form loads, the server generates a cryptographically signed challenge using HMAC-SHA256. No database write occurs at this stage.
2. **Client-Side Mining**: When a user focuses on the comment textarea, a JavaScript Web Worker begins mining in the background.
3. **Solution Discovery**: The worker repeatedly hashes the challenge string (nonce + timestamp + salt) with incrementing counter values until it finds a hash with the required number of leading zeros.
4. **Server Verification**: On submission, the server first verifies the HMAC signature (ensuring the challenge wasn't tampered with), then validates the PoW solution, and finally stores a transient to prevent replay attacks.

=== Features ===

* **Zero Database Bloat on Load** - Challenges are generated using stateless HMAC signatures, meaning the plugin requires exactly zero database writes when a visitor loads a page.
* **Zero Dependencies** - No external APIs or services required.
* **Client-Side Mining** - Heavy computation happens in the user's browser using Web Workers.
* **Deferred Execution** - The cryptographic mining engine only spins up when a user interacts with the comment field, ensuring casual readers incur zero performance penalty.
* **Self-Cleaning Replay Protection** - Server-side state is only stored upon a successful comment submission to prevent bot replay attacks, and expired tokens are automatically swept by WordPress cron.
* **Server-Side Verification** - Server verifies HMAC signature first, then performs SHA-256 PoW validation.
* **Configurable Difficulty** - Adjust the number of leading zeros required (1-8).
* **Configurable Time Window** - Set how long challenges remain valid (5-120 minutes).
* **Non-Intrusive** - Works transparently for legitimate users; spammers must complete the PoW challenge.
* **WordPress Standards** - Follows WordPress coding standards and best practices.
* **Privacy First (GDPR Friendly)** - No cookies, no user tracking, no CAPTCHA popups, and absolutely zero data sent to third-party cloud APIs.
* **Smart Pathway Protection** - Flawlessly protects frontend forms and blocks XML-RPC botnets, while seamlessly allowing native Trackbacks and authenticated REST API requests.

== Architecture & Testing ===

Cardea is built with an enterprise-grade engineering stack focused on reliability and performance:

**Frontend Architecture:**
* Zero-dependency JavaScript using native Web Crypto APIs (crypto.subtle)
* Web Workers for background cryptographic mining (non-blocking UI)
* Stateless HMAC-SHA256 signatures for challenge generation (no database on page load)

**Backend Architecture:**
* Localized replay protection using WordPress transients
* Auto-cleaning expired tokens via WordPress cron
* Single verification pass: signature check + PoW validation

**Testing Stack:**
* **PHPUnit** - Backend logic verification (HMAC generation, challenge validation, replay prevention)
* **Jest** - Cryptographic worker validation (difficulty checking, solution finding, message interface)
* **Playwright** - End-to-End browser testing integrated with WordPress Playground (full WordPress environment)

This comprehensive testing approach ensures the plugin handles legitimate users seamlessly while actively blocking sophisticated bot attacks.

== Installation ==

1. Upload the `cardea` folder to your `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Configure the settings under Settings > Cardea PoW.

== Frequently Asked Questions ==

= Does this plugin slow down comment submission? =

For legitimate users, the mining happens in the background while they type their comment. Most users won't notice any delay. The default difficulty level (4 zeros) typically takes 1-5 seconds on modern devices.

= Can spammers bypass this? =

While no solution is 100% foolproof, this makes automated spam economically unviable. Spammers would need significant CPU resources to submit comments, making mass spam campaigns impractical.

= Does this work on mobile devices? =

Yes, but the mining may take slightly longer on older or slower mobile devices. You can reduce the difficulty setting if you notice issues.

= Does this protect against human-spammers? =

This plugin primarily protects against automated bots. For human-spammers, consider using additional measures like moderation queues or other anti-spam plugins.

= Will this affect SEO bots or REST API submissions? =

This plugin only affects the native WordPress comment form. REST API comments, XML-RPC, and other methods are not affected.

= Does it track users? =

No, this plugin is 100% local and does not track users. The PoW challenge is generated per-session and is not tied to any user data.

= Will this break my comment form for legitimate users? =

No. The mining happens transparently in the background while users type. Most users won't even notice it happening. The default difficulty is set to provide a good balance between security and user experience.

= What happens if JavaScript is disabled? =

The comment form will still work, but submissions without a valid PoW solution will be rejected. This is intentional - automated spammers typically don't execute JavaScript.

= Does this plugin add database entries on page load? =

No! This is a key differentiator. Unlike most security plugins that query the database on every page load, Cardea generates challenges using stateless HMAC signatures. Database writes only occur when a user actually submits a comment, making this ideal for high-traffic sites.

== Developer Rigor ==

Cardea is built with an enterprise-grade engineering stack focused on reliability and performance:

**Architecture:**
* **Zero Database Bloat on Load** - Stateless HMAC signatures ensure zero database writes on page load
* **Self-Cleaning Replay Protection** - Uses WordPress transients that auto-expire via cron
* **Deferred Execution** - Mining only starts when user interacts with comment field

**Testing Stack:**
* **PHPUnit** - Backend logic verification (HMAC generation, challenge validation, replay prevention)
* **Jest** - Cryptographic worker validation (difficulty checking, solution finding, message interface)
* **Playwright** - End-to-End browser testing integrated with WordPress Playground (full WordPress environment)

**Cross-Theme Compatibility:**
* Uses HTMLFormElement.prototype.submit.call() to bypass DOM clobbering issues
* Graceful fallback for browsers without Web Worker support

== Changelog ==

= 1.0.0 =
* Initial release
* HMAC-signed challenge generation (zero DB writes on page load)
* Web Worker-based client-side mining
* Admin settings page
* Configurable difficulty and time window
* Self-cleaning replay protection via WordPress transients

== Upgrade Notice ==

= 1.0.0 =
Initial release of the Cardea - Proof-of-Work Comment Spam Protection plugin.
