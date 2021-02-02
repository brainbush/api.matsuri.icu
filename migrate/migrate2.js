const MongoClient = require('mongodb').MongoClient;
const {Pool} = require('pg');
const mongo_url = 'mongodb://localhost:27017/';
const mongo_options = {
    useUnifiedTopology: true,
    auto_reconnect: true,
    poolSize: 20,
    connectTimeoutMS: 60000,
    serverSelectionTimeoutMS: 5000
};
const db_name = 'matsuri_icu';

function expand(rowCount, startAt = 1) {
    let index = startAt
    return Array(rowCount).fill(0).map(v => `($${index++}, to_timestamp($${index++}), $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`).join(", ")
}


function sliceArray(arr, size) {
    let arr2 = [];
    for (let i = 0; i < arr.length; i = i + size) {
        arr2.push(arr.slice(i, i + size));
    }
    return arr2;
}


const pg_pool = new Pool()

console.log('pg connected')

async function get_channels() {
    const mongo_client = MongoClient(mongo_url, mongo_options);
    await mongo_client.connect();
    const mongo_db = mongo_client.db(db_name);
    let results_cursor
    // results_cursor = mongo_db.collection('clip').find({start_time: {$lte: 1609430400000}}, {projection: {_id: 0}});
    // results_cursor = mongo_db.collection('clip').find({
    //     start_time: {
    //         $gte: 1609430400000,
    //         $lte: 1612108800000
    //     }
    // }, {projection: {_id: 0}});
    results_cursor = mongo_db.collection('clip').find({start_time: {$gte: 1612108800000}}, {projection: {_id: 0}});
    while (await results_cursor.hasNext()) {
        let clip
        clip = await results_cursor.next();
        let t = await pg_pool.query('SELECT COUNT(*) FROM clip_info WHERE id=$1', [clip.id])
        if (t.rows[0].count !== '0') {
            console.log(`${clip.id} exists`)
            continue
        }
        const query_text = 'INSERT INTO clip_info (id, bilibili_uid, title, start_time, end_time, cover, danmu_density, total_danmu, total_gift, total_superchat, total_reward, highlights, viewers) ' +
            'VALUES($1, $2, $3, to_timestamp($4), to_timestamp($5), $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *'
        let values = [clip.id, clip.bilibili_uid, clip.title, clip.start_time / 1000 || null, clip.end_time / 1000 || null, clip.cover || null, clip.danmu_density || null, clip.total_danmu || null, clip.total_gift || null, clip.total_superchat || null, clip.total_reward || null, JSON.stringify(clip.highlights) || null, clip.views || null]
        const pg_client = await pg_pool.connect();
        await pg_client.query(query_text, values)
        .then(r => {
            if (r) console.log(`${r.rows[0].id} ${r.rows[0].bilibili_uid} ${r.rows[0].title} ${r.rows[0].start_time}`)
            pg_client.release()
        })
        if (clip.hasOwnProperty('full_comments')) {
            if (clip.full_comments.length > 0) {
                let full_comments_sliced = sliceArray(clip.full_comments, 5000)
                let id = clip.id
                let liver_uid = clip.bilibili_uid
                console.log('处理comments')
                for (let comments of full_comments_sliced) {
                    let processed_array = []
                    for (let comment of comments) {
                        let text
                        if (comment.hasOwnProperty('text')) {
                            text = await comment.text.replace(/\0/g, '')
                        } else {
                            text = null
                        }
                        await processed_array.push(
                            id,
                            comment.time / 1000 || null,
                            comment.username || null,
                            comment.user_id || null,
                            comment.superchat_price || null,
                            comment.gift_name || null,
                            comment.gift_price || null,
                            comment.gift_num || null,
                            text,
                            liver_uid)
                    }
                    let query = `INSERT INTO comments (clip_id, "time", username, user_id, superchat_price, gift_name, gift_price, gift_num, "text", liver_uid) VALUES ${expand(comments.length)}`
                    const pg_client = await pg_pool.connect();
                    pg_client.query(query, processed_array)
                    .catch(e => {
                        console.log(e)
                        console.log(processed_array)
                    }).then(
                        pg_client.release()
                    )
                }
            }
        }
    }
    console.log('end')
}

(async () => {
    await get_channels()
    return 0;
})();