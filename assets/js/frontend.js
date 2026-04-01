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
 * Handles the Proof-of-Work mining process using a Web Worker.
 */

/* global cardeaConfig */

(function() {
	'use strict';

	let worker = null;
	let solution = null;
	let isMining = false;
	let submitForm = null;
	let isSolved = false;

	/**
	 * Get challenge data from hidden fields.
	 *
	 * @returns {Object|null} Challenge data or null if not found.
	 */
	function getChallengeData() {
		const nonce = document.getElementById('cardea-nonce');
		const difficulty = document.getElementById('cardea-difficulty');
		const timestamp = document.getElementById('cardea-timestamp');
		const salt = document.getElementById('cardea-salt');

		if (!nonce || !difficulty || !timestamp || !salt) {
			return null;
		}

		return {
			nonce: nonce.value,
			difficulty: parseInt(difficulty.value, 10),
			timestamp: timestamp.value,
			salt: salt.value
		};
	}

	/**
	 * Build the challenge string.
	 *
	 * @param {Object} challenge Challenge data.
	 * @returns {string} Challenge string.
	 */
	function buildChallengeString(challenge) {
		return challenge.nonce + '|' + challenge.timestamp + '|' + challenge.salt;
	}

	/**
	 * Start mining in a Web Worker.
	 */
	function startMining() {
		if (isMining || isSolved) {
			return;
		}

		const challenge = getChallengeData();
		if (!challenge) {
			return;
		}

		isMining = true;
		const challengeString = buildChallengeString(challenge);
		const difficulty = challenge.difficulty;

		if (!worker && window.cardeaWorkerUrl) {
			worker = new Worker(window.cardeaWorkerUrl);
		}

		if (!worker) {
			console.error('Native PoW: Web Worker not available');
			isMining = false;
			return;
		}

		worker.onmessage = function(e) {
			if (e.data.solution !== undefined) {
				solution = e.data.solution;
				isSolved = true;
				isMining = false;

				const solutionField = document.getElementById('cardea-solution');
				if (solutionField) {
					solutionField.value = solution;
				}

				if (submitForm) {
					const submitBtn = submitForm.querySelector('input[type="submit"], button[type="submit"]');
					if (submitBtn) {
						submitBtn.disabled = false;
						submitBtn.value = cardeaConfig.i18n.solved;
					}
					HTMLFormElement.prototype.submit.call(submitForm);
					submitForm = null;
				}

				terminateWorker();
			}
		};

		worker.onerror = function(e) {
			console.error('Native PoW: Worker error', e);
			isMining = false;
		};

		worker.postMessage({
			challenge: challengeString,
			difficulty: difficulty
		});
	}

	/**
	 * Terminate the Web Worker.
	 */
	function terminateWorker() {
		if (worker) {
			worker.terminate();
			worker = null;
		}
	}

	/**
	 * Handle form submit event.
	 *
	 * @param {Event} e Submit event.
	 */
	function handleFormSubmit(e) {
		if (!isSolved && isMining) {
			e.preventDefault();
			submitForm = e.target;

			const submitBtn = submitForm.querySelector('input[type="submit"], button[type="submit"]');
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.value = cardeaConfig.i18n.verifying;
			}

			return false;
		}

		if (!isSolved && !isMining) {
			e.preventDefault();
			startMining();
			submitForm = e.target;

			const submitBtn = submitForm.querySelector('input[type="submit"], button[type="submit"]');
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.value = cardeaConfig.i18n.verifying;
			}

			return false;
		}
	}

	/**
	 * Find the comment form element.
	 *
	 * @returns {HTMLFormElement|null} The comment form element.
	 */
	function findCommentForm() {
		// Try standard ID first
		let form = document.getElementById('commentform');
		if (form) {
			return form;
		}

		// Fallback: find form containing textarea[name="comment"]
		const textarea = document.querySelector('textarea[name="comment"]');
		if (textarea) {
			form = textarea.closest('form');
			if (form) {
				return form;
			}
		}

		return null;
	}

	/**
	 * Find the comment textarea.
	 *
	 * @returns {HTMLElement|null} The comment textarea.
	 */
	function findCommentField() {
		// Try standard ID first
		let field = document.getElementById('comment');
		if (field) {
			return field;
		}

		// Fallback: find textarea with name="comment"
		field = document.querySelector('textarea[name="comment"]');
		return field;
	}

	/**
	 * Initialize the script.
	 */
	function init() {
		const commentForm = findCommentForm();
		if (!commentForm) {
			return;
		}

		const commentField = findCommentField();
		if (!commentField) {
			return;
		}

		commentField.addEventListener('focus', function onFirstFocus() {
			commentField.removeEventListener('focus', onFirstFocus);
			startMiningWithFallback();
		}, { once: true });

		commentField.addEventListener('input', function onFirstInput() {
			commentField.removeEventListener('input', onFirstInput);
			startMiningWithFallback();
		}, { once: true });

		commentForm.addEventListener('submit', handleFormSubmit);

		window.addEventListener('beforeunload', terminateWorker);
	}

	/**
	 * Start mining with fallback for browsers without Web Worker support.
	 */
	function startMiningWithFallback() {
		if (!window.Worker) {
			// Graceful fallback: show message and allow submission
			console.warn('Native PoW: Web Workers not supported, skipping PoW challenge.');
			isSolved = true;
			return;
		}
		startMining();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
