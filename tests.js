const {expect} = require('chai');
const {describe, it} = require('mocha');
const nock = require('nock');
const sinon = require('sinon');
const superagent = require('superagent');

const {NoclistClient} = require('./');

describe('NoclistClient', () => {
	const {getChecksumHeader} = NoclistClient;
	
	let stubs = sinon.createSandbox();
	
	beforeEach(() => {
		nock.cleanAll();
		stubs.restore();
	});
	
	describe('.getChecksumHeader', () => {
		it('should return the sha256 hash of a request path without a leading slash', () => {
			expect(getChecksumHeader('12345', 'users')).to.equal('c20acb14a3d3339b9e92daebb173e41379f9f2fad4aa6a6326a696bd90c67419');
		});
		
		it('should return the sha256 hash of a request path with a leading slash', () => {
			expect(getChecksumHeader('12345', '/users')).to.equal('c20acb14a3d3339b9e92daebb173e41379f9f2fad4aa6a6326a696bd90c67419');
		});
	});
	
	describe('.getRequestUrl', () => {
		const {getRequestUrl} = NoclistClient
		it('should return a complete url for a request path without a leading slash', () => {
			expect(getRequestUrl('auth')).to.equal('http://0.0.0.0:8888/auth');
		});
		
		it('should return a complete url for a request path with a leading slash', () => {
			expect(getRequestUrl('/auth')).to.equal('http://0.0.0.0:8888/auth');
		});
	});
	
	describe('.makeRequest', () => {
		const getMockedSuccessfulResponse = () => {
			return nock('http://0.0.0.0:8888')
				.get('/test-retries')
				.reply(200);
		}
		
		const getMockedFailedResponse = () => {
			return nock('http://0.0.0.0:8888')
			.get('/test-retries')
			.reply(500, 'server error');
		}
		
		it('should retry if receives failed response', async () => {
			const client = new NoclistClient();
			const makeRequest_spy = stubs.spy(client, 'makeRequest');
			//note nock will throw an error if each endpoint is not hit
			const mocked_failed_response = getMockedFailedResponse();
			const mocked_success_response = getMockedSuccessfulResponse();
			await client.makeRequest(() => {
				return superagent.get('http://0.0.0.0:8888/test-retries')
			});
			expect(mocked_failed_response.isDone()).to.be.true;
			expect(mocked_success_response.isDone()).to.be.true;
			expect(makeRequest_spy.callCount).to.equal(2);
		});
		
		it('should exit the process after the 3rd try with a failed response', async () => {
			const client = new NoclistClient();
			const makeRequest_spy = stubs.spy(client, 'makeRequest');
			const exit_stub = stubs.stub(process, 'exit');
			//note nock will throw an error if each endpoint is not hit
			const mocked_failed_response = getMockedFailedResponse();
			const mocked_failed_response_2 = getMockedFailedResponse();
			const mocked_failed_response_3 = getMockedFailedResponse();
			await client.makeRequest(() => {
				return superagent.get('http://0.0.0.0:8888/test-retries')
			});
			expect(mocked_failed_response.isDone()).to.be.true;
			expect(mocked_failed_response_2.isDone()).to.be.true;
			expect(mocked_failed_response_3.isDone()).to.be.true;
			expect(makeRequest_spy.callCount).to.equal(4);
			expect(exit_stub.calledOnce).to.be.true;
		});
	});
	
	describe('.auth', () => {
		it('should call the proper endpoint and set the auth token', async () => {
			const client = new NoclistClient();
			const fake_auth_token = 'fake_auth_token';
			const mocked_response = nock('http://0.0.0.0:8888')
				.get('/auth')
				.reply(200, 'random string', {
					'badsec-authentication-token': fake_auth_token
				});
			await client.auth();
			expect(client.auth_token).to.equal(fake_auth_token);
			expect(mocked_response.isDone()).to.be.true;
		});
	});
	
	describe('fetchUsers', () => {
		it('sets the checksum header on request and returns array of users', async () => {
			const client = new NoclistClient();
			client.auth_token = '12345';
			const mocked_response = nock('http://0.0.0.0:8888', {
				reqHeaders: {
					'X-Request-Checksum': 'c20acb14a3d3339b9e92daebb173e41379f9f2fad4aa6a6326a696bd90c67419'
				}
			}).get('/users')
			.reply(200, 'user1\nuser2')
			const users = await client.fetchUsers();
			expect(users).to.deep.equal(['user1', 'user2']);
		});
	});
});

