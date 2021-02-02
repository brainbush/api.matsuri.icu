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
    // return Array(rowCount).fill(0).map(v => `(${Array(columnCount).fill(0).map(v => `$${index++}`).join(", ")})`).join(", ")

    return Array(rowCount).fill(0).map(v => `(to_timestamp($${index++}), $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`).join(", ")
}

function sliceArray(arr, size) {
    let arr2 = [];
    for (let i = 0; i < arr.length; i = i + size) {
        arr2.push(arr.slice(i, i + size));
    }
    return arr2;
}


const pg_pool = new Pool()

async function get_channels() {
    const mongo_client = MongoClient(mongo_url, mongo_options);
    await mongo_client.connect();
    const mongo_db = mongo_client.db(db_name);
    let results_cursor
    results_cursor = mongo_db.collection('off_comments').find({}, {projection: {_id: 0}});
    while (await results_cursor.hasNext()) {
        let clip = await results_cursor.next();

        if (clip.hasOwnProperty('comments')) {
            if (clip.comments.length > 0) {
                let full_comments_sliced = sliceArray(clip.comments, 5000)
                let liver_uid = clip.name.split('_')[0]
                console.log(`处理comments ${clip.name}`)
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
                    // console.log(processed_array.length)
                    let query = `INSERT INTO off_comments ("time", username, user_id, superchat_price, gift_name, gift_price, gift_num, "text", liver_uid) VALUES ${expand(comments.length)}`
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