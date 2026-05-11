
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hm_rr_21326682?retryWrites=true&w=majority&appName=Cluster0');
const db = client.db('hm_rr_21326682');
const collections = await db.listCollections().toArray();
const names = collections.map(c => c.name);
const required = ['bookings', 'users', 'hotels', 'rooms'];
const found = required.filter(r => names.includes(r));
const missing = required.filter(r => !names.includes(r));
console.log(JSON.stringify({ totalCollections: names.length, found, missing }));
await client.close();
