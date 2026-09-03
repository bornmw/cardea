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
 *
 * @package Cardea
 */

/**
 * PHPUnit Test Case for Cardea_Comment_Gate
 *
 * @package Cardea
 */

/**
 * Test case for Cardea_Comment_Gate class.
 */
class Cardea_Comment_Gate_Test extends PHPUnit\Framework\TestCase {

	/**
	 * Core instance.
	 *
	 * @var Cardea_Core
	 */
	private $core;

	/**
	 * Gate instance.
	 *
	 * @var Cardea_Comment_Gate
	 */
	private $gate;

	/**
	 * Set up the test.
	 */
	protected function setUp(): void {
		parent::setUp();
		global $wp_options, $wp_transients, $current_user;
		$wp_options    = array();
		$wp_transients = array();
		$current_user  = null;
		$_POST         = array();

		update_option( 'cardea_difficulty', 4 );
		update_option( 'cardea_time_window', 30 );

		$this->core = new Cardea_Core();
		$this->gate = new Cardea_Comment_Gate( $this->core );
	}

	/**
	 * Test form submission with missing fields fails with the generic message.
	 */
	public function test_verify_form_submission_missing_fields() {
		$_POST['cardea_nonce'] = '';
		$_POST['cardea_timestamp'] = '1234567890';
		$_POST['cardea_salt'] = 'testsalt';
		$_POST['cardea_solution'] = '';
		$_POST['cardea_signature'] = 'testsig';

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( Cardea_Core::failure_message() );

		$this->gate->verify_form_submission( array() );
	}

	/**
	 * Test form submission with an invalid nonce fails with the generic message.
	 */
	public function test_verify_form_submission_invalid_nonce() {
		$_POST['cardea_nonce'] = 'invalid_nonce';
		$_POST['cardea_timestamp'] = (string) time();
		$_POST['cardea_salt'] = 'testsalt';
		$_POST['cardea_solution'] = '12345';
		$_POST['cardea_signature'] = 'testsig';

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( Cardea_Core::failure_message() );

		$this->gate->verify_form_submission( array() );
	}

	/**
	 * Test form submission with an invalid solution fails with the generic message.
	 */
	public function test_verify_form_submission_invalid_solution() {
		$challenge = $this->core->generate_challenge( 1 );

		$_POST['cardea_nonce'] = $challenge['nonce'];
		$_POST['cardea_timestamp'] = (string) $challenge['timestamp'];
		$_POST['cardea_salt'] = $challenge['salt'];
		$_POST['cardea_solution'] = 'invalid';
		$_POST['cardea_signature'] = $challenge['signature'];

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( Cardea_Core::failure_message() );

		$this->gate->verify_form_submission( array() );
	}

	/**
	 * Test form submission accepts a valid submission.
	 */
	public function test_verify_form_submission_success() {
		$challenge = $this->core->generate_challenge( 1 );
		$solution  = $this->find_solution( $this->core->build_challenge_string( $challenge ), $challenge['difficulty'] );

		$_POST['cardea_nonce'] = $challenge['nonce'];
		$_POST['cardea_timestamp'] = (string) $challenge['timestamp'];
		$_POST['cardea_salt'] = $challenge['salt'];
		$_POST['cardea_solution'] = $solution;
		$_POST['cardea_signature'] = $challenge['signature'];

		$commentdata = array( 'comment_post_ID' => 1 );
		$result      = $this->gate->verify_form_submission( $commentdata );

		$this->assertEquals( $commentdata, $result );
	}

	/**
	 * Test form submission bypasses for users with moderate_comments capability.
	 */
	public function test_verify_form_submission_bypasses_for_moderator() {
		global $current_user;
		$current_user = new WP_User();
		$current_user->caps = array( 'moderate_comments' => true );

		$_POST['cardea_nonce'] = '';

		$commentdata = array( 'comment_post_ID' => 1 );
		$result      = $this->gate->verify_form_submission( $commentdata );

		$this->assertEquals( $commentdata, $result );

		$current_user  = null;
		$_POST         = array();
	}

	/**
	 * Test form submission bypasses for pingback comment type.
	 */
	public function test_verify_form_submission_bypasses_for_pingback() {
		$_POST['cardea_nonce'] = '';

		$commentdata = array(
			'comment_post_ID' => 1,
			'comment_type'    => 'pingback',
		);
		$result        = $this->gate->verify_form_submission( $commentdata );

		$this->assertEquals( $commentdata, $result );

		$_POST         = array();
	}

	/**
	 * Test form submission bypasses for trackback comment type.
	 */
	public function test_verify_form_submission_bypasses_for_trackback() {
		$_POST['cardea_nonce'] = '';

		$commentdata = array(
			'comment_post_ID' => 1,
			'comment_type'    => 'trackback',
		);
		$result        = $this->gate->verify_form_submission( $commentdata );

		$this->assertEquals( $commentdata, $result );

		$_POST         = array();
	}

	/**
	 * Test form submission bypasses for logged-in users.
	 */
	public function test_verify_form_submission_bypasses_for_logged_in_user() {
		global $current_user;
		$current_user = new WP_User();

		$_POST['cardea_nonce'] = '';

		$commentdata = array(
			'comment_post_ID' => 1,
			'comment_type'    => 'comment',
		);
		$result        = $this->gate->verify_form_submission( $commentdata );

		$this->assertEquals( $commentdata, $result );

		$current_user  = null;
		$_POST         = array();
	}

	/**
	 * Test form submission validates for logged-out users with comment type 'comment'.
	 */
	public function test_verify_form_submission_validates_for_logged_out_comment_type() {
		$_POST['cardea_nonce'] = '';
		$_POST['cardea_timestamp'] = '1234567890';
		$_POST['cardea_salt'] = 'testsalt';
		$_POST['cardea_solution'] = '';
		$_POST['cardea_signature'] = 'testsig';

		$commentdata = array(
			'comment_post_ID' => 1,
			'comment_type'    => 'comment',
		);

		$this->expectException( Exception::class );
		$this->expectExceptionMessage( Cardea_Core::failure_message() );

		$this->gate->verify_form_submission( $commentdata );
	}

	/**
	 * Test REST submission bypasses for moderators.
	 */
	public function test_verify_rest_submission_bypasses_for_moderator() {
		global $current_user;
		$current_user = new WP_User();
		$current_user->caps = array( 'moderate_comments' => true );

		$request = $this->createMockWP_REST_Request( 'comment', 1 );
		$result  = $this->gate->verify_rest_submission( array(), $request );

		$this->assertEquals( array(), $result );

		$current_user  = null;
	}

	/**
	 * Test REST submission bypasses for pingbacks.
	 */
	public function test_verify_rest_submission_bypasses_for_pingback() {
		$request = $this->createMockWP_REST_Request( 'pingback', 1 );
		$result  = $this->gate->verify_rest_submission( array(), $request );

		$this->assertEquals( array(), $result );
	}

	/**
	 * Test REST submission bypasses for trackbacks.
	 */
	public function test_verify_rest_submission_bypasses_for_trackback() {
		$request = $this->createMockWP_REST_Request( 'trackback', 1 );
		$result  = $this->gate->verify_rest_submission( array(), $request );

		$this->assertEquals( array(), $result );
	}

	/**
	 * Test REST submission bypasses for logged-in users.
	 */
	public function test_verify_rest_submission_bypasses_for_logged_in_user() {
		global $current_user;
		$current_user = new WP_User();

		$request = $this->createMockWP_REST_Request( 'comment', 1 );
		$result  = $this->gate->verify_rest_submission( array(), $request );

		$this->assertEquals( array(), $result );

		$current_user  = null;
	}

	/**
	 * Test REST submission rejects anonymous users without challenge fields.
	 */
	public function test_verify_rest_submission_rejects_missing_fields() {
		$request = $this->createMockWP_REST_Request( 'comment', 1 );
		$result  = $this->gate->verify_rest_submission( array(), $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_verification_failed', $result->get_error_code() );
		$this->assertEquals( 403, $this->error_status( $result ) );
	}

	/**
	 * Test REST submission rejects anonymous submissions with an invalid nonce.
	 */
	public function test_verify_rest_submission_rejects_invalid_nonce() {
		$request = $this->createMockWP_REST_Request(
			'comment',
			1,
			array(
				'cardea_nonce'     => 'invalid_nonce',
				'cardea_timestamp' => (string) time(),
				'cardea_salt'      => 'testsalt',
				'cardea_solution'  => '12345',
				'cardea_signature' => 'testsig',
			)
		);

		$result = $this->gate->verify_rest_submission( array(), $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_verification_failed', $result->get_error_code() );
	}

	/**
	 * Test REST submission rejects anonymous submissions with an invalid solution.
	 */
	public function test_verify_rest_submission_rejects_invalid_solution() {
		$challenge = $this->core->generate_challenge( 1 );

		$request = $this->createMockWP_REST_Request(
			'comment',
			1,
			array(
				'cardea_nonce'     => $challenge['nonce'],
				'cardea_timestamp' => (string) $challenge['timestamp'],
				'cardea_salt'      => $challenge['salt'],
				'cardea_solution'  => 'invalid',
				'cardea_signature' => $challenge['signature'],
			)
		);

		$result = $this->gate->verify_rest_submission( array(), $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertEquals( 'cardea_verification_failed', $result->get_error_code() );
	}

	/**
	 * Test REST submission accepts anonymous submissions with a valid PoW solution.
	 */
	public function test_verify_rest_submission_accepts_valid_solution() {
		$challenge = $this->core->generate_challenge( 1 );
		$solution  = $this->find_solution( $this->core->build_challenge_string( $challenge ), $challenge['difficulty'] );

		$request = $this->createMockWP_REST_Request(
			'comment',
			1,
			array(
				'cardea_nonce'     => $challenge['nonce'],
				'cardea_timestamp' => (string) $challenge['timestamp'],
				'cardea_salt'      => $challenge['salt'],
				'cardea_solution'  => $solution,
				'cardea_signature' => $challenge['signature'],
			)
		);

		$prepared = array( 'post_id' => 1 );
		$result   = $this->gate->verify_rest_submission( $prepared, $request );

		$this->assertEquals( $prepared, $result );
	}

	/**
	 * Read the status from a WP_Error data payload (helper for assertions).
	 *
	 * @param WP_Error $error The error.
	 * @return int
	 */
	private function error_status( $error ) {
		$data = $error->get_error_data();
		return is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 0;
	}

	/**
	 * Create a mock WP_REST_Request object.
	 *
	 * @param string $comment_type Optional comment type to configure.
	 * @param int    $post_id      Optional post ID to configure.
	 * @param array  $params       Optional map of additional request parameters.
	 * @return object
	 */
	private function createMockWP_REST_Request( $comment_type = null, $post_id = null, $params = array() ) {
		return new class( $comment_type, $post_id, $params ) {
			private $comment_type;
			private $post_id;
			private $params;

			public function __construct( $comment_type = null, $post_id = null, $params = array() ) {
				$this->comment_type = $comment_type;
				$this->post_id      = $post_id;
				$this->params       = $params;
			}

			public function get_param( $param ) {
				if ( 'comment_type' === $param ) {
					return $this->comment_type;
				}
				if ( 'post_id' === $param ) {
					return $this->post_id;
				}
				return isset( $this->params[ $param ] ) ? $this->params[ $param ] : null;
			}
		};
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
