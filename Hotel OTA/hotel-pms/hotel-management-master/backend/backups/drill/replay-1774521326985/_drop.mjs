
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hm_rr_21326682?retryWrites=true&w=majority&appName=Cluster0');
await client.db('hm_rr_21326682').dropDatabase();
await client.close();
console.log('dropped');
