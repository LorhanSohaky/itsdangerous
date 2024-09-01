// Example 3: Timed Serialization with Expiry Check
import {TimedSerializer} from '../dist/index.js';

const authSerializer = new TimedSerializer({secretKey: 'secret key', salt: 'auth'});
const token = await authSerializer.stringify({id: 5, name: 'itsdangerous'});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
	await sleep(6000);
	// This will throw an error if the token has expired
	const data = await authSerializer.parse(token, undefined, 5, true);
} catch (err) {
	console.log(err.name); // SignatureExpiredError
	console.log(err.message); // Signature age 6 > 5 seconds
}
