const {ok} = require('assert');
const crypto = require('crypto');
const path = require('path');
const {URL} = require('url');
const superagent = require('superagent');

const {badsec_server_url, max_retries} = require('./config');

class NoclistClient {
	static getChecksumHeader(auth_token, request_path) {
		ok(auth_token);
		ok(request_path);
		return crypto.createHash('sha256').update(path.join(auth_token, request_path)).digest('hex');
	}
	
	static getRequestUrl(request_path) {
		return new URL(request_path, badsec_server_url).href
	}
	
	auth_token = null;
	
	assertAuthToken() {
		ok(this.auth_token, 'auth_token not yet set');
	}
	
	getChecksumHeader(request_path) {
		this.assertAuthToken();
		return this.constructor.getChecksumHeader(this.auth_token, request_path);
	}
	
	getAuthedRequest(request, request_path) {
		this.assertAuthToken();
		return request.set('X-Request-Checksum', this.getChecksumHeader(request_path))
	}
	
	async auth() {
		const response = await this.makeRequest(() => {
			return superagent.get(this.constructor.getRequestUrl('auth'));
		});
				
		ok(response.headers['badsec-authentication-token'], 'Auth response does not contain token');
		this.auth_token = response.headers['badsec-authentication-token'];
	}
	
	async fetchUsers() {
		const user_response = await this.makeRequest(() => {
			return this.getAuthedRequest(
				superagent.get(this.constructor.getRequestUrl('users')),
				'users'
			);
		});
		return user_response.text.split('\n');
	}
	
	async printUsers() {
		const users = await this.fetchUsers();
		console.log('Users:');
		console.log(JSON.stringify(users));
	}
	
	async makeRequest(getRequest, retry = 0) {
		if (retry > max_retries) {
			console.error('Request exceeded retry count')
			return process.exit(1)
		}
		try {
			const response = await getRequest();
			return response;
		} catch (e) {
			if (e.response) {
				console.error('Error making request:', e.response.text);
				return this.makeRequest(getRequest, retry + 1);
			}
			throw e; //Program error
		}
	}
}

module.exports = {
	NoclistClient
}