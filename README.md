<div align="center">

# itsdangerous.js

**... so better sign this.**

> Note: This is an unofficial JavaScript port of the Python library
> [itsdangerous](https://github.com/pallets/itsdangerous).

`itsdangerous.js` provides various helpers for securely serializing data and passing it through untrusted environments. The data is cryptographically signed to ensure that it hasn't been tampered with during transmission or storage.

Key features include customizable serialization, optional compression, timestamp support for expiring signatures, and compatibility with various cryptographic algorithms.

[Features](#features) |
[Installation](#installation) |
[Usage](#usage) |
[License](#license) |
[Contributing](#contributing)

</div>

## Status

<a href="https://github.com/hampuskraft/itsdangerous.js/blob/master/LICENSE.md"><img alt="License" src="https://img.shields.io/github/license/hampuskraft/itsdangerous.js?style=flat-square"></a>
<a href="https://github.com/hampuskraft/itsdangerous.js/issues"><img alt="Issues" src="https://img.shields.io/github/issues/hampuskraft/itsdangerous.js?style=flat-square"></a>
<a href="https://github.com/hampuskraft/itsdangerous.js/pulls"><img alt="Pull Requests" src="https://img.shields.io/github/issues-pr/hampuskraft/itsdangerous.js?style=flat-square"></a>
<a href="https://github.com/hampuskraft/itsdangerous.js/actions"><img alt="Actions" src="https://img.shields.io/github/checks-status/hampuskraft/itsdangerous.js/main?style=flat-square"></a>

## Features

- **Secure Serialization**: Convert JavaScript objects to safe, URL-friendly strings that can be signed to protect against tampering.
- **Timed Signatures**: Add timestamps to signatures, enabling support for expiring tokens.
- **Secret Key Rotation**: Manage multiple keys for signing, supporting key rotation for enhanced security.
- **Flexible Algorithms**: Supports different cryptographic algorithms like HMAC with SHA1, SHA256, SHA512, etc.
- **Payload Compression**: Automatically compress and decompress payloads to optimize storage and transmission.
- **URL-Safe Formats**: Encodes data into URL-safe strings, perfect for embedding in URLs or cookies.

## Installation

```sh
npm install itsdangerous.js
```

## Usage

Below are some practical use cases and basic examples. For more examples, see the [examples](examples) directory.

### Use Cases

- **Tokenized URLs**: Sign user IDs or other data in URLs (e.g., unsubscribe links) to eliminate the need for storing one-time tokens in the database.
- **Stateless Sessions**: Store signed objects in cookies or other untrusted sources, removing the need for server-side session storage.

- **Round-Trip Data**: Safely pass server-side state to the client and back, verifying its integrity upon return.

### Basic Serialization and Signing

#### URL-Safe Serialization

```js
import {URLSafeSerializer} from 'itsdangerous.js';

const authSerializer = new URLSafeSerializer({secretKey: 'secret key', salt: 'auth'});
const token = await authSerializer.stringify({id: 5, name: 'itsdangerous'});

console.log(token); // eyJpZCI6NSwibmFtZSI6Iml0c2Rhbmdlcm91cyJ9.6YP6T0BaO67XP--9UzTrmurXSmg

const data = await authSerializer.parse(token);
console.log(data.name); // itsdangerous
```

#### Timed Signatures

```js
import {URLSafeTimedSerializer} from 'itsdangerous.js';

const authSerializer = new URLSafeTimedSerializer({secretKey: 'secret key', salt: 'auth'});
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
```

## License

This project is licensed under the [MIT license](LICENSE).

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get involved and submit your changes.
