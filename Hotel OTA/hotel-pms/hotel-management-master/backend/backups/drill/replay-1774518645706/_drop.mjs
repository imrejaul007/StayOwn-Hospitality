
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management_restore_replay_1774518645505?retryWrites=true&w=majority&appName=Cluster0');
await client.db('hotel-management_restore_replay_1774518645505').dropDatabase();
await client.close();
console.log('dropped');
