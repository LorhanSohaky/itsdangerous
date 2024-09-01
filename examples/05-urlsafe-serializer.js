// Example 5: URL-Safe Serialization
import {URLSafeSerializer} from '../dist/index.js';

const authSerializer = new URLSafeSerializer({secretKey: 'secret key', salt: 'auth'});
const token = await authSerializer.stringify({id: 5, name: 'itsdangerous'});

console.log(token); // eyJpZCI6NSwibmFtZSI6Iml0c2Rhbmdlcm91cyJ9.6YP6T0BaO67XP--9UzTrmurXSmg

const data = await authSerializer.parse(token);
console.log(data.name); // itsdangerous
