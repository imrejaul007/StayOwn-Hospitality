
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hm_rr_21574389?retryWrites=true&w=majority&appName=Cluster0');
const db = client.db('hm_rr_21574389');
const collections = await db.listCollections().toArray();
const names = collections.map(c => c.name);
const required = ['bookings', 'users', 'rooms', 'invoices', 'payments'];
const found = required.filter(r => names.includes(r));
const missing = required.filter(r => !names.includes(r));
if (missing.length) {
  throw new Error('Missing required collections: ' + missing.join(', '));
}
console.log(JSON.stringify({ totalCollections: names.length, found, missing }));
await client.close();
