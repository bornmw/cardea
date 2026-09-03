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
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * Performs the heavy SHA-256 hashing to find a valid Proof-of-Work solution.
 *
 * Uses a compact synchronous SHA-256 (FIPS 180-4) so mining works in any
 * secure OR insecure context (no crypto.subtle dependency) and avoids the
 * per-digest Promise overhead of the WebCrypto batched approach. The server
 * remains the sole verifier of the hash, so this client implementation only
 * affects mining speed, never verification.
 */

(function() {
	'use strict';

	/* SHA-256 round constants (FIPS 180-4, 4.2.2).
	 * First 32 bits of the fractional parts of the cube roots of the first 64 primes. */
	const K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	]);


	/* SHA-256 initial hash values (FIPS 180-4, 5.3.3).
	 * First 32 bits of the fractional parts of the square roots of the first 8 primes. */
	const INIT = new Uint32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
		0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
	]);


	const HEX_CHARS = '0123456789abcdef';

	/**
	 * Right rotate (32-bit).
	 *
	 * @param {number} v Value.
	 * @param {number} n Bits.
	 * @returns {number}
	 */
	function rotr(v, n) {
		return (v >>> n) | (v << (32 - n));
	}

	/**
	 * Compact incremental SHA-256 hasher.
	 */
	class Sha256 {
		constructor() {
			this.state = new Uint32Array(INIT);
			this.block = new Uint8Array(64);
			this.blockLen = 0;
			this.byteLen = 0;
		}

		/**
		 * Feed bytes into the hasher.
		 *
		 * @param {Uint8Array} data Input bytes.
		 * @returns {Sha256} This hasher (for chaining).
		 */
		update(data) {
			const off0 = 0;
			let off = off0;
			const n = data.length;

			/* Complete any partially-filled block first. */
			if (this.blockLen > 0) {
				const take = Math.min(n, 64 - this.blockLen);
				this.block.set(data.subarray(off, off + take), this.blockLen);
				off += take;
				this.blockLen += take;
				if (this.blockLen === 64) {
					this.compress(this.block);
					this.blockLen = 0;
				}
			}

			/* Consume full blocks in place. */
			while (off + 64 <= n) {
				this.compress(data.subarray(off, off + 64));
				off += 64;
			}

			/* Buffer the remainder. */
			if (off < n) {
				this.block.set(data.subarray(off), 0);
				this.blockLen = n - off;
			}

			this.byteLen += n;
			return this;
		}

		/**
		 * Compress one 64-byte block into the state.
		 *
		 * @param {Uint8Array} block 64-byte block.
		 */
		compress(block) {
			const w = new Uint32Array(64);
			for (let i = 0; i < 16; i++) {
				w[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
			}
			for (let i = 16; i < 64; i++) {
				const w15 = w[i - 15];
				const w2 = w[i - 2];
				const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
				const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
				w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
			}

			const h = this.state;
			let a = h[0], b = h[1], c = h[2], d = h[3];
			let e = h[4], f = h[5], g = h[6], hh = h[7];

			for (let i = 0; i < 64; i++) {
				const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
				const ch = (e & f) ^ (~e & g);
				const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
				const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
				const maj = (a & b) ^ (a & c) ^ (b & c);
				const t2 = (S0 + maj) | 0;
				hh = g;
				g = f;
				f = e;
				e = (d + t1) | 0;
				d = c;
				c = b;
				b = a;
				a = (t1 + t2) | 0;
			}

			h[0] = (h[0] + a) | 0;
			h[1] = (h[1] + b) | 0;
			h[2] = (h[2] + c) | 0;
			h[3] = (h[3] + d) | 0;
			h[4] = (h[4] + e) | 0;
			h[5] = (h[5] + f) | 0;
			h[6] = (h[6] + g) | 0;
			h[7] = (h[7] + hh) | 0;
		}

		/**
		 * Finalize and return the 32-byte digest.
		 *
		 * @returns {Uint8Array} Digest.
		 */
		digest() {
			const bitLen = this.byteLen * 8;
			const rem = this.blockLen;
			const zeros = (rem > 55 ? 128 : 64) - rem - 1 - 8;

			/* 0x80 + zero padding + 64-bit big-endian bit length. */
			const pad = new Uint8Array(zeros + 9);
			pad[0] = 0x80;
			const hi = Math.floor(bitLen / 4294967296);
			const lo = bitLen >>> 0;
			pad[zeros + 1] = hi >>> 24;
			pad[zeros + 2] = hi >>> 16;
			pad[zeros + 3] = hi >>> 8;
			pad[zeros + 4] = hi;
			pad[zeros + 5] = lo >>> 24;
			pad[zeros + 6] = lo >>> 16;
			pad[zeros + 7] = lo >>> 8;
			pad[zeros + 8] = lo;

			this.update(pad);

			const out = new Uint8Array(32);
			for (let i = 0; i < 8; i++) {
				out[i * 4] = this.state[i] >>> 24;
				out[i * 4 + 1] = this.state[i] >>> 16;
				out[i * 4 + 2] = this.state[i] >>> 8;
				out[i * 4 + 3] = this.state[i];
			}
			return out;
		}
	}

	/**
	 * Convert bytes to a hex string.
	 *
	 * @param {Uint8Array} bytes Bytes.
	 * @returns {string}
	 */
	function toHex(bytes) {
		let out = '';
		for (let i = 0; i < bytes.length; i++) {
			out += HEX_CHARS[bytes[i] >> 4] + HEX_CHARS[bytes[i] & 15];
		}
		return out;
	}

	/**
	 * SHA-256 of a UTF-8 string.
	 *
	 * @param {string} str Input string.
	 * @returns {string} Hex digest.
	 */
	function sha256Hex(str) {
		return toHex(new Sha256().update(new TextEncoder().encode(str)).digest());
	}

	/**
	 * Check if a hash meets the difficulty requirement.
	 *
	 * @param {string} hash       The hash.
	 * @param {number} difficulty Required leading zeros.
	 * @returns {boolean}
	 */
	function meetsDifficulty(hash, difficulty) {
		const prefix = '0'.repeat(difficulty);
		return hash.startsWith(prefix);
	}

	/**
	 * Find a valid PoW solution (unbounded counter).
	 *
	 * @param {string} challenge  Challenge string (nonce|timestamp|salt).
	 * @param {number} difficulty Required leading zeros.
	 * @returns {string} The solution (counter value).
	 */
	function findSolution(challenge, difficulty) {
		const prefixBytes = new TextEncoder().encode(challenge);
		const prefix = '0'.repeat(difficulty);
		const encoder = new TextEncoder();

		let counter = 0;
		for (;;) {
			/*
			 * Message layout (unchanged from the WebCrypto era):
			 * SHA-256(challenge + counter), counter as a bare decimal string.
			 */
			const digest = new Sha256().update(prefixBytes).update(encoder.encode(String(counter))).digest();
			if (meetsDifficulty(toHex(digest), difficulty)) {
				return counter.toString();
			}
			counter++;
		}
	}

if (typeof self !== 'undefined') {
		self.onmessage = function(e) {
			const { challenge, difficulty } = e.data;

			if (!challenge || !difficulty) {
				self.postMessage({ error: 'Missing parameters' });
				return;
			}

			const solution = findSolution(challenge, difficulty);
			self.postMessage({ solution: solution });
		};
	}

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = { Sha256, sha256Hex, toHex, meetsDifficulty, findSolution };
	}
})();
