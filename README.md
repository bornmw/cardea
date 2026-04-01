# Cardea - Proof-of-Work Comment Spam Protection

Cardea is a high-performance, zero-dependency WordPress plugin designed to mitigate comment spam using client-side cryptographic Proof-of-Work (PoW). 

## 🏗️ Architecture & Philosophy

[cite_start]Unlike traditional anti-spam solutions that rely on heavy database lookups, CAPTCHAs, or third-party APIs, Cardea uses a **stateless architecture**[cite: 5, 8]:

* [cite_start]**Zero DB Writes on Page Load:** Challenges are generated dynamically using HMAC signatures derived from WordPress salts[cite: 5].
* [cite_start]**Client-Side Mining:** Heavy SHA-256 computation is offloaded to a background Web Worker, ensuring the main UI thread remains fluid for the user[cite: 1, 4].
* **Stateless Validation:** The server verifies solutions mathematically. [cite_start]It only records state (via transients) upon a successful submission to prevent replay attacks.

## 🧪 Engineering Rigor

[cite_start]This project utilizes a multi-tiered, containerized testing strategy to ensure reliability across environments without requiring local host dependencies[cite: 1, 6]:

* [cite_start]**E2E Integration:** Playwright tests running against a WASM-based WordPress Playground[cite: 1, 4, 6].
* [cite_start]**JS Unit Testing:** Jest suite for Web Worker cryptographic verification[cite: 6].
* [cite_start]**PHP Unit Testing:** PHPUnit for core HMAC signing and WordPress hook logic[cite: 6].

## 🚀 Development & Build

[cite_start]The development environment is entirely ephemeral and containerized via Docker[cite: 1, 5].

### Prerequisites
* Docker
* Make

### Setup & Testing
1.  **Build and Install Dependencies:**
    This builds the local `cardea-dev` image and populates your `vendor` and `node_modules` folders[cite: 1, 6].
    ```bash
    make install
    ```
2.  **Run Full Test Suite:**
    Executes Jest, PHPUnit, and Playwright E2E tests sequentially[cite: 6].
    ```bash
    make test
    ```
3.  **Generate Production Package:**
    Creates a clean, production-ready ZIP in the `dist/` directory, automatically excluding all development artifacts, test caches, and browser binaries[cite: 7, 8].
    ```bash
    make package
    ```

## 📄 License

[cite_start]GPLv2 or later.

