# itsdangerous.js

... so better sign this.

Various helpers to pass data to untrusted environments and to get it back safe and sound. Data is cryptographically
signed to ensure that a token has not been tampered with.

It's possible to customize how data is serialized. Data is compressed as needed. A timestamp can be added and verified
automatically while loading a token.

> Note: This is an unofficial Node.js port of the Python library
> [itsdangerous](https://github.com/pallets/itsdangerous).

## Installing

```sh
npm install itsdangerous.js
```

## Usage

```js
import {URLSafeSerializer} from 'itsdangerous.js';

const authSerializer = new URLSafeSerializer({secretKey: 'secret key', salt: 'auth'});
const token = authSerializer.stringify({id: 5, name: 'itsdangerous'});

console.log(token.toString()); // eyJpZCI6NSwibmFtZSI6Iml0c2Rhbmdlcm91cyJ9.6YP6T0BaO67XP--9UzTrmurXSmg

const data = authSerializer.parse(token);
console.log(data.name); // itsdangerous
```
