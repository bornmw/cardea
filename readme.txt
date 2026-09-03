=== Cardea - Proof-of-Work Comment Spam Protection ===
Contributors: omikheev
Tags: comments, spam, protection, proof-of-work, anti-spam
Requires at least: 6.0
Requires PHP: 7.4
Tested up to: 7.1
Stable tag: 1.0.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lightweight, zero-dependency Proof-of-Work anti-spam protection for WordPress comments.

== Description ==

Are you tired of anti-spam plugins that bloat your site, inject third-party tracking, or constantly upsell you on premium SaaS subscriptions? Are you looking for a straightforward, lightweight solution that just protects your comments without the extra baggage?

Then Cardea is the right tool for you.

Cardea is a radically simple, zero-dependency Proof-of-Work (PoW) comment spam protector. Developed transparently on GitHub as a purely open-source project, it does one thing and does it perfectly: it stops automated bot spam on native WordPress comments.

### Why Choose Cardea?

Cardea offers distinct advantages for site owners who value simplicity, privacy, and performance:

1. **Hyper-Focused & Zero Bloat** - Cardea is strictly dedicated to the native WordPress comment system. Unlike multi-purpose anti-spam plugins that inject heavy compatibility layers for various form builders and e-commerce platforms, Cardea remains extremely lightweight and performant—protecting only what you need protected.

2. **100% Standalone & Sovereign** - No external API keys. No commercial SaaS tiers. No phone-home telemetry. Cardea is entirely self-hosted and self-contained. Your comment protection never depends on a third-party service staying alive.

3. **Strict Privacy (GDPR Compliant)** - Because the Proof-of-Work computation happens locally in each visitor's browser, there are no tracking cookies, no user profiles, and no third-party data transfers. Unlike cloud-based CAPTCHA solutions, Cardea transmits nothing to external servers—making it inherently GDPR-friendly.

4. **Reduced Attack Surface** - By doing one thing perfectly (protecting native comments), Cardea avoids the security vulnerabilities inherent in massive, multi-ecosystem integrations. A focused codebase means fewer CVEs and tighter security.

5. **Plug-and-Play Simplicity** - No complex routing rules. No integration toggles. No configuration mazes. Users simply activate Cardea and their discussion threads are protected immediately.

To view the source code, contribute, or report issues, visit the [Cardea GitHub Repository](https://github.com/bornmw/cardea).

=== How It Works ===

1. **Challenge Generation**: When a page with a comment form loads, the server generates a cryptographically signed challenge using HMAC-SHA256. No database write occurs at this stage.
2. **Client-Side Mining**: When a user focuses on the comment textarea, a JavaScript Web Worker begins mining in the background.
3. **Solution Discovery**: The worker repeatedly hashes the challenge string (nonce + timestamp + salt) with incrementing counter values until it finds a hash with the required number of leading zeros.
4. **Server Verification**: On submission, the server first verifies the HMAC signature (ensuring the challenge wasn't tampered with), then validates the PoW solution, and finally records the used signature in a capped, self-pruning replay store to prevent replay attacks.

=== Features ===

* **Zero Database Bloat on Load** - Challenges are generated using stateless HMAC signatures, meaning the plugin requires exactly zero database writes when a visitor loads a page.
* **Zero Dependencies** - No external APIs or services required.
* **Client-Side Mining** - Heavy computation happens in the user's browser using Web Workers.
* **Deferred Execution** - The cryptographic mining engine only spins up when a user interacts with the comment field, ensuring casual readers incur zero performance penalty.
* **Self-Cleaning Replay Protection** - Server-side state is only stored upon a successful comment submission to prevent bot replay attacks; expired entries are pruned automatically and the store is capped (1024 signatures).
* **Server-Side Verification** - Server verifies HMAC signature first, then performs SHA-256 PoW validation.
* **Configurable Difficulty** - Adjust the number of leading zeros required (1-8).
* **Configurable Time Window** - Set how long challenges remain valid (5-120 minutes).
* **Non-Intrusive** - Works transparently for legitimate users; spammers must complete the PoW challenge.
* **WordPress Standards** - Follows WordPress coding standards and best practices.
* **Privacy First (GDPR Friendly)** - No cookies, no user tracking, no CAPTCHA popups, and absolutely zero data sent to third-party cloud APIs.
* **Smart Pathway Protection** - Gates anonymous comment submission end to end: the comment form requires a solved Proof-of-Work challenge, and anonymous REST comment creation is already rejected by WordPress core (401) — Cardea additionally applies the same PoW check to any REST comment creation core permits, as a defense-in-depth layer. Native Trackbacks/Pingbacks and authenticated requests are allowed.
* **Page Caching Compatible** - Uses dynamic REST API endpoint to fetch fresh challenges, ensuring compatibility with edge caching (Cloudflare, Varnish) and full-page caching plugins.
* **Logged-In User Bypass** - Skips PoW challenge for authenticated users, eliminating unnecessary CPU usage on the frontend.

== Architecture & Testing ===

Cardea is built with an enterprise-grade engineering stack focused on reliability and performance:

**Frontend Architecture:**
* Zero-dependency JavaScript using native Web Crypto APIs (crypto.subtle)
* Web Workers for background cryptographic mining (non-blocking UI)
* Dynamic challenge fetching via REST API (compatible with page caching)
* Skip PoW for logged-in users (zero CPU overhead for authenticated commenters)

**Backend Architecture:**
* Localized replay protection via a capped replay store (single option, no per-token rows)
* Self-pruning: expired entries are cleared automatically on write (no cron dependency)
* Single verification pass: signature check + PoW validation
* Single-use tokens: a challenge can be redeemed exactly once, which bounds any interception-style attack to a single comment (standard one-shot-token semantics)

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

Anonymous comment submissions are gated everywhere. In the comment form, a solved PoW challenge is required. For the REST API (`wp/v2/comments`), WordPress core already rejects anonymous comment creation with a 401 (`rest_comment_login_required`); Cardea additionally runs the same PoW verification on `rest_pre_insert_comment`, so if core ever permits anonymous REST comments, they will still need a solved challenge. Trackbacks, pingbacks, XML-RPC calls, and requests from logged-in users or moderators are not affected. WordPress core does not expose anonymous comment creation over XML-RPC either, so no Cardea hook is needed there.

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
* **Self-Cleaning Replay Protection** - Uses a capped replay store that prunes expired entries automatically
* **Deferred Execution** - Mining only starts when user interacts with comment field

**Testing Stack:**
* **PHPUnit** - Backend logic verification (HMAC generation, challenge validation, replay prevention)
* **Jest** - Cryptographic worker validation (difficulty checking, solution finding, message interface)
* **Playwright** - End-to-End browser testing integrated with WordPress Playground (full WordPress environment)

**Cross-Theme Compatibility:**
* Uses HTMLFormElement.prototype.submit.call() to bypass DOM clobbering issues
* Graceful fallback for browsers without Web Worker support

== Changelog ==

= 1.0.2 =
* Security: REST comment submissions now go through the same PoW verification as the comment form.
* Security: unified, generic verification failure messages (per-cause codes no longer revealed to clients).
* Security: configured difficulty is applied at verification time.
* Performance: replay protection is a single capped (1024), self-pruning `cardea_used` option instead of two transient rows per comment.
* Performance: synchronous in-worker SHA-256 mining - no `crypto.subtle` dependency (works on non-secure/HTTP contexts) and no counter cap; server verification wire format unchanged.
* Compatibility: WordPress 7.1 removed `set_option()`; plugin writes now use `update_option()`.
* Architecture: new `Cardea_Comment_Gate` class (pure PoW core), single source of truth for the version in tests, unified packaging exclusions, shared e2e fixture.
* Docs: accurate XML-RPC/REST behavior notes, difficulty solve-time guidance.

= 1.0.1 =
* Verified compatibility with WordPress 7.1

= 1.0.0 =
* Initial release
* HMAC-signed challenge generation (zero DB writes on page load)
* Web Worker-based client-side mining
* Admin settings page
* Configurable difficulty and time window
* Self-cleaning replay protection via WordPress transients

== Upgrade Notice ==

= 1.0.2 =
Security and performance improvements: REST PoW verification parity, bounded self-pruning replay store, synchronous in-worker SHA-256 miner (works over plain HTTP too), WordPress 7.1 `set_option()` compatibility.

= 1.0.1 =
Verified compatibility with the latest WordPress 7.1.

= 1.0.0 =
Initial release of the Cardea - Proof-of-Work Comment Spam Protection plugin.
