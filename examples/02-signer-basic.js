// Example 2: Signing and Unsigning with Signer
import {Signer} from '../dist/index.js';

const signer = new Signer({secretKey: 'secret-key'});
const signature = await signer.sign('foo');

const data = await signer.unsign(signature);
const original = new TextDecoder().decode(data);
console.log(original); // foo
