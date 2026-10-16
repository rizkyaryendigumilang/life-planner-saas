import PocketBase from 'pocketbase';
const url = process.env.PB_URL || 'http://127.0.0.1:8090';
const superuserEmail = process.env.PB_SUPERUSER_EMAIL;
const superuserPassword = process.env.PB_SUPERUSER_PASSWORD;
if (!superuserEmail || !superuserPassword) throw new Error('Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.');
const pb = new PocketBase(url);
await pb.collection('_superusers').authWithPassword(superuserEmail, superuserPassword);
let record;
try { record = await pb.collection('users').getFirstListItem('username = "kiky"'); }
catch { record = null; }
const data = { username: 'kiky', email: 'kiky@lifeplanner.local', role: 'superadmin', is_password_temp: false, password: 'kiky123', passwordConfirm: 'kiky123', emailVisibility: false };
if (record) await pb.collection('users').update(record.id, data); else await pb.collection('users').create(data);
console.log('Application superadmin ready: kiky / kiky123');
