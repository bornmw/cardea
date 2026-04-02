# Cardea - Proof-of-Work Comment Spam Protection

Cardea is a high-performance, zero-dependency WordPress plugin designed to mitigate comment spam using client-side cryptographic Proof-of-Work (PoW). 

## 🏗️ Architecture & Philosophy

Unlike traditional anti-spam solutions that rely on heavy database lookups, CAPTCHAs, or third-party APIs, Cardea uses a **stateless architecture**:

* **Zero DB Writes on Page Load:** Challenges are generated dynamically using HMAC signatures derived from WordPress salts.
* **Client-Side Mining:** Heavy SHA-256 computation is offloaded to a background Web Worker, ensuring the main UI thread remains fluid for the user.
* **Stateless Validation:** The server verifies solutions mathematically. It only records state (via transients) upon a successful submission to prevent replay attacks.

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
