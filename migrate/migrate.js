const MongoClient = require('mongodb').MongoClient;
const {Client} = require('pg');
const mongo_url = 'mongodb://localhost:27017/';
const mongo_options = {
    useUnifiedTopology: true,
    auto_reconnect: true,
    poolSize: 20,
    connectTimeoutMS: 60000,
    serverSelectionTimeoutMS: 5000
};
const db_name = 'matsuri_icu';


const pg_client = new Client()

console.log('pg connected')

async function get_channels() {
    const mongo_client = MongoClient(mongo_url, mongo_options);
    await mongo_client.connect();
    const mongo_db = mongo_client.db(db_name);
    return mongo_db.collection('channel').find({}, {projection: {_id: 0}}).toArray();
}

async function to_db(channels) {
    await pg_client.connect();
    console.log(channels.length)
    for (let i = 0; i < channels.length; i++) {
        let channel = channels[i];
        const query_text = 'INSERT INTO channels (name, bilibili_uid, bilibili_live_room, is_live, last_danmu, total_clips, total_danmu, face, hidden, last_live) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10) ) RETURNING *'
        let values = [channel.name, channel.bilibili_uid, channel.bilibili_live_room, channel.is_live, channel.last_danmu, channel.total_clips, channel.total_danmu, channel.face, channel.hidden, channel.last_live / 1000 || null];
        pg_client.query(query_text, values).then(r => {
            if (r) console.log(r.rows[0])
        }).catch(e => console.error(e));
    }
}

(async () => {
    let channels = await get_channels()
    await to_db(channels)
    return 0;
})();