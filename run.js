const {NoclistClient} = require('./');

(async function() {
	const client = new NoclistClient();
	console.log('Authorizing...');
	await client.auth();
	console.log('Fetching users...');
	await client.printUsers();
})();