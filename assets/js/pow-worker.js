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
 *
 * Performs the heavy SHA-256 hashing to find a valid Proof-of-Work solution.
 */

(function() {
	'use strict';

	/**
	 * Convert string to Uint8Array.
	 *
	 * @param {string} str String to convert.
	 * @returns {Uint8Array}
	 */
	function stringToUint8Array(str) {
		return new TextEncoder().encode(str);
	}

	/**
	 * Convert ArrayBuffer to hex string.
	 *
	 * @param {ArrayBuffer} buffer Buffer to convert.
	 * @returns {string}
	 */
	function bufferToHex(buffer) {
		const byteArray = new Uint8Array(buffer);
		return Array.from(byteArray)
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Check if hash meets difficulty requirement.
	 *
	 * @param {string} hash       Hash to check.
	 * @param {number} difficulty Number of leading zeros required.
	 * @returns {boolean}
	 */
	function meetsDifficulty(hash, difficulty) {
		const prefix = '0'.repeat(difficulty);
		return hash.startsWith(prefix);
	}

	/**
	 * Find a valid PoW solution.
	 *
	 * @param {string} challenge  Challenge string.
	 * @param {number} difficulty Required difficulty.
	 * @returns {Promise<string>} The solution (counter value).
	 */
	async function findSolution(challenge, difficulty) {
		let counter = 0;
		const batchSize = 1000;

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const batch = [];

			for (let i = 0; i < batchSize; i++) {
				batch.push(counter + i);
			}

			const results = await Promise.all(
				batch.map(c => {
					const input = challenge + c;
					return crypto.subtle.digest('SHA-256', stringToUint8Array(input))
						.then(buffer => ({
							counter: c,
							hash: bufferToHex(buffer)
						}));
				})
			);

			for (const result of results) {
				if (meetsDifficulty(result.hash, difficulty)) {
					return result.counter.toString();
				}
			}

			counter += batchSize;

			if (counter > 100000000) {
				counter = 0;
			}
		}
	}

	self.onmessage = async function(e) {
		const { challenge, difficulty } = e.data;

		if (!challenge || !difficulty) {
			self.postMessage({ error: 'Missing parameters' });
			return;
		}

		try {
			const solution = await findSolution(challenge, difficulty);
			self.postMessage({ solution: solution });
		} catch (error) {
			self.postMessage({ error: error.message });
		}
	};
})();
