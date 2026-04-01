<?php
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
 * PHPUnit Test Case for Cardea_Core
 *
 * @package Cardea
 */

/**
 * Test case for Cardea_Core class.
 */
class Cardea_Core_Test extends PHPUnit\Framework\TestCase {

	/**
	 * Core instance.
	 *
	 * @var Cardea_Core
	 */
	private $core;

	/**
	 * Set up the test.
	 */
	protected function setUp(): void {
		parent::setUp();
		global $wp_options, $wp_transients;
		$wp_options   = array();
		$wp_transients = array();

		update_option( 'cardea_difficulty', 4 );
		update_option( 'cardea_time_window', 30 );

		$this->core = new Cardea_Core();
	}

	/**
	 * Test default difficulty.
	 */
	public function test_get_difficulty() {
		$this->assertEquals( 4, $this->core->get_difficulty() );
	}

	/**
	 * Test default time window.
	 */
	public function test_get_time_window() {
		$this->assertEquals( 30, $this->core->get_time_window() );
	}

	/**
	 * Test challenge generation includes signature.
	 */
	public function test_generate_challenge() {
		$challenge = $this->core->generate_challenge( 1 );

		$this->assertArrayHasKey( 'nonce', $challenge );
		$this->assertArrayHasKey( 'timestamp', $challenge );
		$this->assertArrayHasKey( 'salt', $challenge );
		$this->assertArrayHasKey( 'difficulty', $challenge );
		$this->assertArrayHasKey( 'signature', $challenge );
		$this->assertEquals( 4, $challenge['difficulty'] );
	}

	/**
	 * Test signature generation and verification.
	 */
	public function test_signature_generation_and_verification() {
		$challenge = $this->core->generate_challenge( 1 );
		$this->assertTrue( $this->core->verify_signature( $challenge ) );

		$challenge['signature'] = 'invalid';
		$this->assertFalse( $this->core->verify_signature( $challenge ) );
	}

	/**
	 * Test challenge string building.
	 */
	public function test_build_challenge_string() {
		$challenge = array(
			'nonce'     => 'test_nonce',
			'timestamp' => 1234567890,
			'salt'      => 'abc123',
		);

		$result = $this->core->build_challenge_string( $challenge );
		$this->assertEquals( 'test_nonce|1234567890|abc123', $result );
	}

	/**
	 * Test hash meets difficulty with valid hash.
	 */
	public function test_hash_meets_difficulty_valid() {
		$hash = '0000abcdef1234567890';
		$this->assertTrue( $this->core->hash_meets_difficulty( $hash, 4 ) );
	}

	/**
	 * Test hash meets difficulty with invalid hash.
	 */
	public function test_hash_meets_difficulty_invalid() {
		$hash = '0001abcdef1234567890';
		$this->assertFalse( $this->core->hash_meets_difficulty( $hash, 4 ) );
	}

	/**
	 * Test hash meets difficulty with higher difficulty.
	 */
	public function test_hash_meets_difficulty_higher() {
		$hash = '00000000abcdef123456';
		$this->assertTrue( $this->core->hash_meets_difficulty( $hash, 8 ) );
	}

	/**
	 * Test verification with missing fields.
	 */
	public function test_verify_solution_missing_fields() {
		$challenge = array(
			'nonce' => '',
			'timestamp' => time(),
			'salt' => 'testsalt',
			'difficulty' => 4,
			'signature' => 'sig',
		);
		$result = $this->core->verify_solution( $challenge, '' );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_missing_fields', $result->get_error_code() );
	}

	/**
	 * Test verification with invalid signature.
	 */
	public function test_verify_solution_invalid_signature() {
		$challenge = $this->core->generate_challenge( 1 );
		$challenge['signature'] = 'invalid_signature';

		$result = $this->core->verify_solution( $challenge, '12345' );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_invalid_signature', $result->get_error_code() );
	}

	/**
	 * Test verification with expired challenge (timestamp in past).
	 */
	public function test_verify_solution_expired() {
		$challenge = $this->core->generate_challenge( 1 );
		$challenge['timestamp'] = time() - 7200;
		$challenge['signature'] = $this->core->generate_signature( $challenge );

		$result = $this->core->verify_solution( $challenge, '12345' );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_expired', $result->get_error_code() );
	}

	/**
	 * Test successful verification with valid solution.
	 */
	public function test_verify_solution_success() {
		$challenge = $this->core->generate_challenge( 1 );
		$challenge_string = $this->core->build_challenge_string( $challenge );

		$solution = $this->find_solution( $challenge_string, $challenge['difficulty'] );

		$result = $this->core->verify_solution( $challenge, $solution );
		$this->assertTrue( $result );
	}

	/**
	 * Test verification with invalid solution.
	 */
	public function test_verify_solution_invalid() {
		$challenge = $this->core->generate_challenge( 1 );

		$result = $this->core->verify_solution( $challenge, 'invalid_solution' );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_invalid', $result->get_error_code() );
	}

	/**
	 * Test replay attack prevention.
	 */
	public function test_replay_attack_prevention() {
		$challenge = $this->core->generate_challenge( 1 );
		$challenge_string = $this->core->build_challenge_string( $challenge );
		$solution = $this->find_solution( $challenge_string, $challenge['difficulty'] );

		$result1 = $this->core->verify_solution( $challenge, $solution );
		$this->assertTrue( $result1 );

		$result2 = $this->core->verify_solution( $challenge, $solution );
		$this->assertInstanceOf( WP_Error::class, $result2 );
		$this->assertEquals( 'cardea_replay', $result2->get_error_code() );
	}

	/**
	 * Test verify_comment_pow triggers wp_die for missing fields.
	 */
	public function test_verify_comment_pow_missing_fields() {
		$_POST['cardea_nonce'] = '';
		$_POST['cardea_timestamp'] = '1234567890';
		$_POST['cardea_salt'] = 'testsalt';
		$_POST['cardea_solution'] = '';
		$_POST['cardea_signature'] = 'testsig';

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( 'Missing challenge fields.' );

		$this->core->verify_comment_pow( array() );
	}

	/**
	 * Test verify_comment_pow triggers wp_die for invalid nonce.
	 */
	public function test_verify_comment_pow_invalid_nonce() {
		$_POST['cardea_nonce'] = 'invalid_nonce';
		$_POST['cardea_timestamp'] = (string) time();
		$_POST['cardea_salt'] = 'testsalt';
		$_POST['cardea_solution'] = '12345';
		$_POST['cardea_signature'] = 'testsig';

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( 'Security check failed.' );

		$this->core->verify_comment_pow( array() );
	}

	/**
	 * Test verify_comment_pow triggers wp_die for invalid solution.
	 */
	public function test_verify_comment_pow_invalid_solution() {
		$challenge = $this->core->generate_challenge( 1 );

		$_POST['cardea_nonce'] = $challenge['nonce'];
		$_POST['cardea_timestamp'] = (string) $challenge['timestamp'];
		$_POST['cardea_salt'] = $challenge['salt'];
		$_POST['cardea_solution'] = 'invalid';
		$_POST['cardea_signature'] = $challenge['signature'];

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( 'Proof-of-Work verification failed.' );

		$this->core->verify_comment_pow( array() );
	}

	/**
	 * Test verify_comment_pow accepts valid submission.
	 */
	public function test_verify_comment_pow_success() {
		$challenge = $this->core->generate_challenge( 1 );
		$challenge_string = $this->core->build_challenge_string( $challenge );
		$solution = $this->find_solution( $challenge_string, $challenge['difficulty'] );

		$_POST['cardea_nonce'] = $challenge['nonce'];
		$_POST['cardea_timestamp'] = (string) $challenge['timestamp'];
		$_POST['cardea_salt'] = $challenge['salt'];
		$_POST['cardea_solution'] = $solution;
		$_POST['cardea_signature'] = $challenge['signature'];

		$commentdata = array( 'comment_post_ID' => 1 );
		$result = $this->core->verify_comment_pow( $commentdata );

		$this->assertEquals( $commentdata, $result );

		// Clean up
		$_POST = array();
	}

	/**
	 * Find a valid solution for the given challenge (for testing).
	 *
	 * @param string $challenge  Challenge string.
	 * @param int    $difficulty Difficulty level.
	 * @return string The solution.
	 */
	private function find_solution( $challenge, $difficulty ) {
		$counter = 0;
		while ( true ) {
			$hash = hash( 'sha256', $challenge . $counter );
			$prefix = str_repeat( '0', $difficulty );
			if ( strpos( $hash, $prefix ) === 0 ) {
				return (string) $counter;
			}
			$counter++;
			if ( $counter > 1000000 ) {
				$this->fail( 'Could not find solution within timeout' );
			}
		}
	}
}
