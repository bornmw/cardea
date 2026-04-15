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
 * Fetches challenge dynamically from REST API to support page caching.
 */

/* global cardeaConfig */

(function() {
	'use strict';

	let worker = null;
	let solution = null;
	let isMining = false;
	let submitForm = null;
	let isSolved = false;
	let challengeFetched = false;

	/**
	 * Fetch a fresh challenge from the REST API.
	 *
	 * @returns {Promise<Object|null>}
	 */
	async function fetchChallenge() {
		try {
			const url = cardeaConfig.restUrl + '?post_id=' + cardeaConfig.postId;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error('Network response was not ok');
			}

			return await response.json();
		} catch (error) {
			console.error('Cardea PoW: Failed to fetch challenge:', error);
			return null;
		}
	}

	/**
	 * Populate hidden fields with challenge data.
	 *
	 * @param {Object} challenge Challenge data from API.
	 */
	function populateFields(challenge) {
		document.getElementById('cardea-nonce').value = challenge.nonce || '';
		document.getElementById('cardea-difficulty').value = challenge.difficulty || '';
		document.getElementById('cardea-timestamp').value = challenge.timestamp || '';
		document.getElementById('cardea-salt').value = challenge.salt || '';
		document.getElementById('cardea-signature').value = challenge.signature || '';
	}

	/**
	 * Get challenge data from hidden fields.
	 *
	 * @returns {Object|null}
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
	 * @returns {string}
	 */
	function buildChallengeString(challenge) {
		return challenge.nonce + '|' + challenge.timestamp + '|' + challenge.salt;
	}

	/**
	 * Start mining in a Web Worker.
	 *
	 * @param {Object} challenge Challenge data.
	 */
	function startMining(challenge) {
		if (isMining || isSolved) {
			return;
		}

		isMining = true;
		const challengeString = buildChallengeString(challenge);
		const difficulty = challenge.difficulty;

		if (!worker && cardeaConfig.workerUrl) {
			worker = new Worker(cardeaConfig.workerUrl);
		}

		if (!worker) {
			console.error('Cardea PoW: Web Worker not available');
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
			console.error('Cardea PoW: Worker error', e);
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
	 * @param {Event} e
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
	 * @returns {HTMLFormElement|null}
	 */
	function findCommentForm() {
		let form = document.getElementById('commentform');
		if (form) {
			return form;
		}

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
	 * @returns {HTMLElement|null}
	 */
	function findCommentField() {
		let field = document.getElementById('comment');
		if (field) {
			return field;
		}

		field = document.querySelector('textarea[name="comment"]');
		return field;
	}

	/**
	 * Fetch challenge and start mining.
	 */
	async function fetchAndMine() {
		if (challengeFetched) {
			const challenge = getChallengeData();
			if (challenge) {
				startMining(challenge);
			}
			return;
		}

		const challenge = await fetchChallenge();
		if (!challenge) {
			return;
		}

		populateFields(challenge);
		challengeFetched = true;
		startMining(challenge);
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
			fetchAndMine();
		}, { once: true });

		commentField.addEventListener('input', function onFirstInput() {
			commentField.removeEventListener('input', onFirstInput);
			fetchAndMine();
		}, { once: true });

		commentForm.addEventListener('submit', handleFormSubmit);

		window.addEventListener('beforeunload', terminateWorker);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();