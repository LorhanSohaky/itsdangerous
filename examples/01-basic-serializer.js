// Example 1: Basic Serialization and Signing with Serializer
import {Serializer} from '../dist/index.js';

const authSerializer = new Serializer({secretKey: 'secret key', salt: 'auth'});
const token = await authSerializer.stringify({id: 5, name: 'itsdangerous'});

console.log(token); // {"id":5,"name":"itsdangerous"}.IXqCCorIA8VFGihf1sqRMzisamQ

const data = await authSerializer.parse(token);
console.log(data.name); // itsdangerous
