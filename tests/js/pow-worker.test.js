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
 * Jest Tests for PoW Worker Mining Logic
 *
 * @package Cardea
 */

const crypto = require('crypto');

function stringToUint8Array(str) {
	return Buffer.from(str, 'utf-8');
}

function bufferToHex(buffer) {
	return Buffer.from(buffer).toString('hex');
}

function meetsDifficulty(hash, difficulty) {
	const prefix = '0'.repeat(difficulty);
	return hash.startsWith(prefix);
}

async function findSolution(challenge, difficulty) {
	let counter = 0;
	const maxIterations = 1000000;
	const batchSize = 1000;

	while (counter < maxIterations) {
		const batch = [];
		for (let i = 0; i < batchSize; i++) {
			batch.push(counter + i);
		}

		const results = await Promise.all(
			batch.map(c => {
				const input = challenge + c;
				return new Promise((resolve) => {
					const hash = crypto.createHash('sha256').update(input).digest();
					resolve({
						counter: c,
						hash: bufferToHex(hash)
					});
				});
			})
		);

		for (const result of results) {
			if (meetsDifficulty(result.hash, difficulty)) {
				return result.counter.toString();
			}
		}

		counter += batchSize;
	}

	throw new Error('Could not find solution within max iterations');
}

/**
 * Simulate Web Worker message handler logic (extracted from pow-worker.js)
 */
async function handleWorkerMessage(data) {
	const { challenge, difficulty } = data;

	if (!challenge || !difficulty) {
		return { error: 'Missing parameters' };
	}

	try {
		const solution = await findSolution(challenge, difficulty);
		return { solution: solution };
	} catch (error) {
		return { error: error.message };
	}
}

describe('PoW Mining Logic', () => {
	test('should find solution for difficulty 1', async () => {
		const challenge = 'test_challenge_123';
		const difficulty = 1;

		const solution = await findSolution(challenge, difficulty);

		const hash = crypto.createHash('sha256').update(challenge + solution).digest('hex');
		expect(meetsDifficulty(hash, difficulty)).toBe(true);
	}, 10000);

	test('should find solution for difficulty 2', async () => {
		const challenge = 'test_challenge_456';
		const difficulty = 2;

		const solution = await findSolution(challenge, difficulty);

		const hash = crypto.createHash('sha256').update(challenge + solution).digest('hex');
		expect(meetsDifficulty(hash, difficulty)).toBe(true);
	}, 30000);

	test('should verify solution correctly', () => {
		expect(meetsDifficulty('0abc123', 1)).toBe(true);
		expect(meetsDifficulty('00abc123', 2)).toBe(true);
		expect(meetsDifficulty('0abc123', 2)).toBe(false);
		expect(meetsDifficulty('1abc123', 1)).toBe(false);
	});

	test('should reject invalid hash for difficulty', () => {
		const hash = '1a2b3c4d5e6f7890';
		
		expect(meetsDifficulty(hash, 1)).toBe(false);
		expect(meetsDifficulty(hash, 0)).toBe(true);
	});

	test('should handle string to buffer conversion', () => {
		const str = 'hello';
		const arr = stringToUint8Array(str);
		
		expect(Buffer.isBuffer(arr)).toBe(true);
		expect(arr.length).toBe(5);
		expect(arr[0]).toBe(104); // 'h' ASCII
	});

	test('should handle buffer to hex conversion', () => {
		const buffer = Buffer.from('abc', 'utf-8');
		const hex = bufferToHex(buffer);
		
		expect(hex).toBe('616263');
	});
});

describe('Web Worker Message Interface', () => {
	test('should return solution for valid challenge and difficulty', async () => {
		const result = await handleWorkerMessage({
			challenge: 'test_challenge_789',
			difficulty: 1
		});

		expect(result).toHaveProperty('solution');
		expect(result).not.toHaveProperty('error');

		// Verify the solution is valid
		const hash = crypto.createHash('sha256')
			.update('test_challenge_789' + result.solution)
			.digest('hex');
		expect(meetsDifficulty(hash, 1)).toBe(true);
	}, 10000);

	test('should return error for missing challenge', async () => {
		const result = await handleWorkerMessage({
			difficulty: 1
		});

		expect(result).toHaveProperty('error');
		expect(result.error).toBe('Missing parameters');
	});

	test('should return error for missing difficulty', async () => {
		const result = await handleWorkerMessage({
			challenge: 'test_challenge_123'
		});

		expect(result).toHaveProperty('error');
		expect(result.error).toBe('Missing parameters');
	});

	test('should return error for empty challenge', async () => {
		const result = await handleWorkerMessage({
			challenge: '',
			difficulty: 1
		});

		expect(result).toHaveProperty('error');
		expect(result.error).toBe('Missing parameters');
	});

	test('should return error for empty difficulty', async () => {
		const result = await handleWorkerMessage({
			challenge: 'test_challenge_123',
			difficulty: 0
		});

		expect(result).toHaveProperty('error');
		expect(result.error).toBe('Missing parameters');
	});

	test('should handle empty data object', async () => {
		const result = await handleWorkerMessage({});

		expect(result).toHaveProperty('error');
		expect(result.error).toBe('Missing parameters');
	});
});
