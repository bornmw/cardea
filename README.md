# Cardea - Proof-of-Work Comment Spam Protection

== Description ==

Are you tired of anti-spam plugins that bloat your site, inject third-party tracking, or constantly upsell you on premium SaaS subscriptions? Are you looking for a straightforward, lightweight solution that just protects your comments without the extra baggage?

Then Cardea is the right tool for you.

Cardea is a radically simple, zero-dependency Proof-of-Work (PoW) comment spam protector. Developed transparently on GitHub as a purely open-source project, it does one thing and does it perfectly: it stops automated bot spam on native WordPress comments.
Cardea is a high-performance, zero-dependency WordPress plugin designed to mitigate comment spam using client-side cryptographic Proof-of-Work (PoW). 

## 🏗️ Architecture & Philosophy

Unlike traditional anti-spam solutions that rely on heavy database lookups, CAPTCHAs, or third-party APIs, Cardea uses a **stateless architecture**:

* **Zero DB Writes on Page Load:** Challenges are generated dynamically using HMAC signatures derived from WordPress salts.
* **Client-Side Mining:** Heavy SHA-256 computation is offloaded to a background Web Worker, ensuring the main UI thread remains fluid for the user.
* **Stateless Validation:** The server verifies solutions mathematically. It only records state (via transients) upon a successful submission to prevent replay attacks.

## Why Choose Cardea?

Cardea offers distinct advantages for site owners who value simplicity, privacy, and performance:

### 1. Hyper-Focused & Zero Bloat
Cardea is strictly dedicated to the native WordPress comment system. Unlike multi-purpose anti-spam plugins that inject heavy compatibility layers for various form builders and e-commerce platforms, Cardea remains extremely lightweight and performant—protecting only what you need protected.

### 2. 100% Standalone & Sovereign
No external API keys. No commercial SaaS tiers. No phone-home telemetry. Cardea is entirely self-hosted and self-contained. Your comment protection never depends on a third-party service staying alive.

### 3. Strict Privacy (GDPR Compliant)
Because the Proof-of-Work computation happens locally in each visitor's browser, there are no tracking cookies, no user profiles, and no third-party data transfers. Unlike cloud-based CAPTCHA solutions, Cardea transmits nothing to external servers—making it inherently GDPR-friendly.

### 4. Reduced Attack Surface
By doing one thing perfectly (protecting native comments), Cardea avoids the security vulnerabilities inherent in massive, multi-ecosystem integrations. A focused codebase means fewer CVEs and tighter security.

### 5. Plug-and-Play Simplicity
No complex routing rules. No integration toggles. No configuration迷宫. Users simply activate Cardea and their discussion threads are protected immediately.

## 🧪 Engineering Rigor

This project utilizes a multi-tiered, containerized testing strategy to ensure reliability across environments without requiring local host dependencies:

* **E2E Integration:** Playwright tests running against a WASM-based WordPress Playground (covering standard UI forms, REST API endpoints, Trackbacks, and XML-RPC vectors).
* **JS Unit Testing:** Jest suite for Web Worker cryptographic verification.
* **PHP Unit Testing:** PHPUnit for core HMAC signing and WordPress hook logic.
* **Automated CI:** Continuous Integration via GitHub Actions validates every push.

## 🚀 Development & Build

The development environment is entirely ephemeral and containerized via Docker.

### Prerequisites
* Docker
* Make

### Setup & Testing
1.  **Build and Install Dependencies:**
    This builds the local `cardea-dev` image and populates your `vendor` and `node_modules` folders.
    ```bash
    make install
    ```
2.  **Run Full Test Suite:**
    Executes Jest, PHPUnit, and Playwright E2E tests sequentially.
    ```bash
    make test
    ```
3.  **Generate Production Package:**
    Creates a clean, production-ready ZIP in the `dist/` directory, automatically excluding all development artifacts and browser binaries.
    ```bash
    make package
    ```

## 📄 License

GPLv2 or later.
