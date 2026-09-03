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
 */

/**
 * Jest Tests for the PoW Worker
 *
 * These tests import the real production worker (assets/js/pow-worker.js)
 * and verify its SHA-256 implementation and mining loop, cross-checked
 * against Node's built-in crypto. The server remains the sole verifier of
 * the hash; these tests guarantee the client mines a verifiable solution.
 *
 * @package Cardea
 */

// jsdom (jest) does not expose TextEncoder; browsers and workers always do.
const { TextEncoder, TextDecoder } = require('util');
if (typeof globalThis.TextEncoder === 'undefined') {
	globalThis.TextEncoder = TextEncoder;
	globalThis.TextDecoder = TextDecoder;
}

const crypto = require('crypto');
const worker = require('../../assets/js/pow-worker.js');

const { sha256Hex, toHex, meetsDifficulty, findSolution } = worker;

function referenceSha256(str) {
	return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

describe('SHA-256 implementation (worker)', () => {
	test('FIPS 180-4 known answer test: "abc"', () => {
		expect(sha256Hex('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});

	test('FIPS 180-4 known answer test: empty string', () => {
		expect(sha256Hex('')).toBe(
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
		);
	});

	test('matches node:crypto across block boundary lengths', () => {
		for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 200, 511, 512, 513, 1024]) {
			const s = ('challenge_').repeat(Math.ceil(n / 10) + 1).slice(0, n);
			expect(sha256Hex(s)).toBe(referenceSha256(s));
		}
	});

	test('matches node:crypto on a production-shaped challenge (55 chars)', () => {
		const challenge = 'AbC123defGHI456jklMNO789pqrsTUV012wxyzABC'; // 38 chars, 1-4 chars of padding variants below
		for (const extra of ['0', '00', '0123456789', 'x'.repeat(20)]) {
			const s = (challenge + extra).slice(0, 55);
			expect(sha256Hex(s)).toBe(referenceSha256(s));
		}
	});

	test('toHex renders bytes as lowercase hex', () => {
		expect(toHex(new Uint8Array([0x00, 0x0a, 0x7f, 0xff]))).toBe('000a7fff');
	});
});

describe('difficulty check (worker)', () => {
	test('accepts hashes with the required leading zeros', () => {
		expect(meetsDifficulty('0abc123', 1)).toBe(true);
		expect(meetsDifficulty('00abc123', 2)).toBe(true);
	});

	test('rejects hashes without the required leading zeros', () => {
		expect(meetsDifficulty('0abc123', 2)).toBe(false);
		expect(meetsDifficulty('1abc123', 1)).toBe(false);
	});
});

describe('mining (worker findSolution)', () => {
	/**
	 * Verify a worker solution the same way the PHP server does:
	 * SHA-256(challengeString + solution) must meet the difficulty.
	 */
	function assertServerVerifiable(challenge, solution, difficulty) {
		const hash = referenceSha256(challenge + solution);
		expect(hash).toMatch(new RegExp('^' + '0'.repeat(difficulty)));
		expect(Number.isFinite(Number(solution))).toBe(true);
	}

	[1, 2, 3, 4].forEach((difficulty) => {
		test(`finds a server-verifiable solution at difficulty ${difficulty}`, () => {
			const challenge = 'test_nonce|1699999999|testsalt';
			const solution = findSolution(challenge, difficulty);
			assertServerVerifiable(challenge, solution, difficulty);
		}, 15000);
	});

	test('produces deterministic solutions for the same challenge', () => {
		const challenge = 'det_nonce|1700000000|detsalt';
		expect(findSolution(challenge, 2)).toBe(findSolution(challenge, 2));
	});
});

describe('worker message interface', () => {
	/**
	 * Simulate a Web Worker host: the production worker attaches its handler
	 * to self.onmessage and delivers results via self.postMessage.
	 */
	function runWorkerMessage(message) {
		const posted = [];
		const originalPostMessage = self.postMessage;
		self.postMessage = (msg) => { posted.push(msg); };
		const handler = self.onmessage;
		try {
			expect(handler).toBeDefined();
			handler({ data: message });
		} finally {
			self.postMessage = originalPostMessage;
		}
		return posted;
	}

	test('posts a solution for a valid challenge and difficulty', () => {
		const posted = runWorkerMessage({
			challenge: 'iface_nonce|1699999999|ifacesalt',
			difficulty: 1
		});

		expect(posted).toHaveLength(1);
		expect(posted[0]).toHaveProperty('solution');
		expect(posted[0]).not.toHaveProperty('error');
		assertServerVerifiableLocally(posted[0].solution);

		function assertServerVerifiableLocally(solution) {
			const hash = referenceSha256('iface_nonce|1699999999|ifacesalt' + solution);
			expect(hash).toMatch(/^0/);
		}
	});

	test('posts an error when the challenge is missing', () => {
		const posted = runWorkerMessage({ difficulty: 1 });
		expect(posted).toHaveLength(1);
		expect(posted[0]).toEqual({ error: 'Missing parameters' });
	});

	test('posts an error when the difficulty is missing', () => {
		const posted = runWorkerMessage({ challenge: 'x' });
		expect(posted).toHaveLength(1);
		expect(posted[0]).toEqual({ error: 'Missing parameters' });
	});

	test('posts an error for an empty challenge', () => {
		const posted = runWorkerMessage({ challenge: '', difficulty: 1 });
		expect(posted).toHaveLength(1);
		expect(posted[0]).toEqual({ error: 'Missing parameters' });
	});
});
