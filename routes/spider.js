const express = require('express');
const router = express.Router();
const cors = require('cors');
const Hashids = require('hashids/cjs');
const https = require('https');

const hashids = new Hashids();

router.all('*', cors());
const db = require('../db');

function sliceArray(arr, size) {
    let arr2 = [];
    for (let i = 0; i < arr.length; i = i + size) {
        arr2.push(arr.slice(i, i + size));
    }
    return arr2;
}

router.post('/start_clip', async (req, res) => {
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({id: 0});
        return
    }
    let data = req.body;
    let start_time, title, cover, bilibili_uid;
    if (data.hasOwnProperty('bilibili_uid')) bilibili_uid = data.bilibili_uid;
    if (data.hasOwnProperty('start_time')) start_time = data.start_time;
    if (data.hasOwnProperty('title')) title = data.title;
    if (data.hasOwnProperty('cover')) cover = data.cover;
    let id = hashids.encode(bilibili_uid, start_time);
    try {
        await db.query('UPDATE channels SET last_live = to_timestamp($1), is_live = true, total_clips=total_clips+1 WHERE bilibili_uid = $2',
            [start_time / 1000, bilibili_uid])
        await db.query('INSERT INTO clip_info (id, bilibili_uid, title, start_time, cover) VALUES($1, $2, $3, to_timestamp($4), $5) RETURNING *',
            [id, bilibili_uid, title, start_time / 1000, cover])
    } catch {
        res.status(500)
    } finally {
        res.send({id: id});
    }
});

router.post('/end_clip', async (req, res) => {
    function expand(rowCount, startAt = 1) {
        let index = startAt
        return Array(rowCount).fill(0).map(() => `($${index++}, to_timestamp($${index++}), $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`).join(", ")
    }

    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let data = req.body;
    let id, end_time, total_danmu, highlights, full_comments, danmu_density, start_time, views = 0;
    if (data.hasOwnProperty('id')) id = data.id;
    if (data.hasOwnProperty('end_time')) end_time = data.end_time;
    if (data.hasOwnProperty('total_danmu')) total_danmu = data.total_danmu;
    if (data.hasOwnProperty('highlights')) highlights = data.highlights;
    if (data.hasOwnProperty('full_comments')) full_comments = data.full_comments;
    if (data.hasOwnProperty('views')) views = data.views;
    let total_gift = 0;
    let total_superchat = 0;
    let total_reward = 0;
    for (let comment of full_comments) {
        if (comment.hasOwnProperty('gift_price')) {
            total_gift += comment.gift_price;
            total_reward += comment.gift_price
        }
        if (comment.hasOwnProperty('superchat_price')) {
            total_superchat += comment.superchat_price;
            total_reward += comment.superchat_price
        }
    }
    total_reward = Math.floor(total_reward * 1000) / 1000;
    total_gift = Math.floor(total_gift * 1000) / 1000;
    try {
        let info = await db.query('SELECT EXTRACT(EPOCH FROM start_time)*1000 AS start_time, bilibili_uid FROM clip_info WHERE id=$1', [id])
        start_time = info.rows[0].start_time;
        if (total_danmu !== 0) {
            danmu_density = Math.round(total_danmu / ((end_time - start_time) / 60000));
        } else {
            danmu_density = 0;
        }
        let clip_info = await db.query('UPDATE clip_info SET end_time = to_timestamp($1), total_danmu = $2, highlights = $3, total_gift = $4, total_superchat = $5, total_reward = $6, danmu_density = $7, viewers = $8 WHERE id = $9 RETURNING bilibili_uid',
            [end_time / 1000, total_danmu, JSON.stringify(highlights), total_gift, total_superchat, total_reward, danmu_density, views, id])
        if (full_comments) {
            if (full_comments.length > 0) {
                let full_comments_sliced = sliceArray(full_comments, 5000)
                let liver_uid = info.rows[0].bilibili_uid
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
                    await db.query(`INSERT INTO comments (clip_id, "time", username, user_id, superchat_price, gift_name, gift_price, gift_num, "text", liver_uid) VALUES ${expand(comments.length)}`, processed_array)
                }
            }
        }
        let bilibili_uid = clip_info.rows[0].bilibili_uid;
        await db.query('UPDATE channels SET is_live = false, last_danmu = $1, total_danmu = total_danmu + $2 WHERE bilibili_uid = $3', [total_danmu, total_danmu, bilibili_uid])
    } catch {
        res.sendStatus(500)
    } finally {
        res.send({status: 0});
    }
});

router.post('/channel_info_update', async (req, res) => {
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let data = req.body.data;
    try {
        data.forEach(channel => {
            db.query('UPDATE channels SET name = $1, face = $2, bilibili_live_room = $3 WHERE bilibili_uid = $4', [channel.name, channel.face, channel.bilibili_live_room, channel.bilibili_uid])
            .catch(e => console.error(e))
        });
    } catch {
        res.status(500)
    } finally {
        res.send({status: 0})
    }
});

router.get('/channel_info_update_new', async (req, res) => {
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let none_list = []
    await https.get('https://api.vtbs.moe/v1/info', response => {
        let output = '';
        response.on('data', (chunk) => {
            output += chunk;
        })
        response.on('end', async () => {
            let obj = JSON.parse(output);
            try {
                let channels = await db.query('SELECT bilibili_uid FROM channels')
                channels = channels.rows;
                console.log(channels)
                for (let channel of channels) {
                    let bilibili_uid = parseInt(channel.bilibili_uid)
                    console.log(bilibili_uid)
                    let new_info = obj.filter(x => x.mid === bilibili_uid)[0]
                    console.log(new_info)
                    if (new_info) {
                        let uname = new_info.uname
                        let roomid = new_info.roomid
                        let face = new_info.face;
                        face = face.replace('http', 'https')
                        await db.query('UPDATE channels SET name = $1, face = $2, bilibili_live_room = $3 WHERE bilibili_uid = $4', [uname, face, roomid, bilibili_uid])
                    } else {
                        none_list.push(bilibili_uid)
                    }
                }
            } catch (e) {
                res.status(500)
                throw e
            } finally {
                res.send(none_list)
            }
        })
    })
})

router.post('/add_channel', async (req, res) => {
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let data = req.body.data;
    try {
        for (let NewChannel of data) {
            let channel_count_info = await db.query('SELECT count(*) FROM channels WHERE bilibili_uid = $1', [NewChannel.bilibili_uid])
            let channel_count = channel_count_info.rows[0].count
            if (channel_count === 0) {
                await db.query('INSERT INTO channels (name, bilibili_uid, bilibili_live_room, is_live, last_danmu, total_clips, total_danmu, face, hidden, last_live) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 ) RETURNING *',
                    [NewChannel.name, NewChannel.bilibili_uid, NewChannel.bilibili_live_room || null, false, 0, 0, 0, NewChannel.face || null, false, null])
            } else {
                console.log(NewChannel.name + ' existed!');
            }
        }
    } catch {
        res.status(500)
    } finally {
        res.send({status: 0})
    }
});

router.post('/upload_offline_comments', async (req, res) => {
    function expand(rowCount, startAt = 1) {
        let index = startAt
        return Array(rowCount).fill(0).map(() => `(to_timestamp($${index++}), $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`).join(", ")
    }

    let status = 0;
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let room_id = undefined;
    let full_comments = [];
    let data = req.body;
    if (data.hasOwnProperty('room_id')) room_id = data.room_id;
    if (data.hasOwnProperty('comments')) full_comments = data.comments;
    try {
        let comments_sliced = sliceArray(full_comments, 1000)
        let r = await db.query('SELECT bilibili_uid FROM channels WHERE bilibili_live_room = $1', [room_id])
        let liver_uid = r.rows[0].bilibili_uid
        for (let comments of comments_sliced) {
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
            await db.query(`INSERT INTO off_comments ("time", username, user_id, superchat_price, gift_name, gift_price, gift_num, "text", liver_uid) VALUES ${expand(comments.length)}`, processed_array)
        }
    } catch (e) {
        console.error(e)
        res.status(500)
    } finally {
        res.send({status: status})
    }
});

module.exports = router;