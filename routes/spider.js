const express = require('express');
const router = express.Router();
const cors = require('cors');
const Hashids = require('hashids/cjs');
const https = require('https');

const hashids = new Hashids();

router.all('*', cors());

router.post('/start_clip', async (req, res) => {
    const db = req.app.locals.db;
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({id: 0});
        return
    }
    let data = req.body;
    let channel_set, start_time, title, live, cover, bilibili_uid;
    if (data.hasOwnProperty('bilibili_uid')) bilibili_uid = data.bilibili_uid;
    if (data.hasOwnProperty('start_time')) start_time = data.start_time;
    if (data.hasOwnProperty('title')) title = data.title;
    if (data.hasOwnProperty('live')) live = data.live;
    if (data.hasOwnProperty('cover')) cover = data.cover;
    if (live) {
        channel_set = {last_live: data.start_time, is_live: true};
    } else {
        channel_set = {is_live: false};
    }
    let id = hashids.encode(bilibili_uid, start_time);
    await db.collection('channel').findOneAndUpdate({bilibili_uid: bilibili_uid},
        {
            $set: channel_set,
            $inc: {total_clips: 1}
        });
    await db.collection('clip').insertOne({
        id: id,
        bilibili_uid: bilibili_uid,
        start_time: start_time,
        title: title,
        live: live,
        cover: cover
    });
    res.send({id: id});
    let list = await db.collection('clip').find({bilibili_uid: bilibili_uid},
        {
            projection: {
                _id: 0,
                full_comments: 0,
                highlights: 0
            }
        }
    ).toArray();
    list = list.reverse()
    req.app.locals.redis_client.set('channel_' + bilibili_uid.toString(), JSON.stringify(list))
});

router.post('/end_clip', async (req, res) => {
    const db = req.app.locals.db;
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
    let info = await db.collection('clip').findOne({id: id});
    start_time = info.start_time;
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
    if (total_danmu !== 0) {
        danmu_density = Math.round(total_danmu / ((end_time - start_time) / 60000));
    } else {
        danmu_density = 0;
    }


    let clip_info = await db.collection('clip').findOneAndUpdate({id: id},
        {
            $set: {
                end_time: end_time,
                total_danmu: total_danmu,
                highlights: highlights,
                full_comments: full_comments,
                total_gift: total_gift,
                total_superchat: total_superchat,
                total_reward: total_reward,
                danmu_density: danmu_density,
                views: views
            }
        });
    let bilibili_uid = clip_info.value.bilibili_uid;
    await db.collection('channel').findOneAndUpdate({bilibili_uid: bilibili_uid},
        {
            $set: {is_live: false, last_danmu: total_danmu},
            $inc: {total_danmu: total_danmu}
        });
    res.send({status: 0});
    let list = await db.collection('clip').find({bilibili_uid: bilibili_uid},
        {
            projection: {
                _id: 0,
                full_comments: 0,
                highlights: 0
            }
        }
    ).toArray();
    list = list.reverse()
    req.app.locals.redis_client.set('channel_' + bilibili_uid.toString(), JSON.stringify(list))
});

router.post('/channel_info_update', async (req, res) => {
    const db = req.app.locals.db;
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let data = req.body.data;
    data.forEach(channel => {
        db.collection('channel').findOneAndUpdate({bilibili_uid: channel.bilibili_uid},
            {$set: {name: channel.name, face: channel.face, bilibili_live_room: channel.bilibili_live_room}})
    });
    res.send({status: 0})
});
let obj;
router.get('/channel_info_update_new', async (req, res) => {
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    const db = req.app.locals.db;
    let none_list = []
    await https.get('https://api.vtbs.moe/v1/info', response => {
        let output = '';
        response.on('data', (chunk) => {
            output += chunk;
        })
        response.on('end', async () => {
            obj = JSON.parse(output);
            await db.collection('channel').find().forEach(channel => {
                let bilibili_uid = channel.bilibili_uid;
                let new_info = obj.filter(x => x.mid === bilibili_uid)[0]
                if (new_info) {
                    let uname = new_info.uname
                    let roomid = new_info.roomid
                    let face = new_info.face;
                    face = face.replace('http', 'https')
                    db.collection('channel').findOneAndUpdate({bilibili_uid: bilibili_uid},
                        {$set: {name: uname, face: face, bilibili_live_room: roomid}})
                } else {
                    //console.log('no such info in this obj:' + bilibili_uid.toString())
                    none_list.push(bilibili_uid)
                }
            })
            res.send(none_list)
        })
    })
})

router.post('/add_channel', async (req, res) => {
    const db = req.app.locals.db;
    const Authorization = req.headers.authorization;
    if (process.env.Authorization !== Authorization) {
        res.status(403);
        res.send({status: 1});
        return;
    }
    let data = req.body.data;
    for (let NewChannel of data) {
        let channel_count = await db.collection('channel').countDocuments({bilibili_uid: NewChannel.bilibili_uid});
        if (channel_count === 0) {
            await db.collection('channel').insertOne({
                name: NewChannel.name,
                bilibili_uid: NewChannel.bilibili_uid,
                bilibili_live_room: NewChannel.bilibili_live_room,
                is_live: false,
                last_live: null,
                last_danmu: 0,
                total_clips: 0,
                total_danmu: 0,
                face: NewChannel.face
            })
        } else {
            console.log(NewChannel.name + ' existed!');
        }
    }
    res.send({status: 0})
});

router.post('/upload_offline_comments', async (req, res) => {
    let status = 0;
    try {
        const db = req.app.locals.db;
        const Authorization = req.headers.authorization;
        if (process.env.Authorization !== Authorization) {
            res.status(403);
            res.send({status: 1});
            return;
        }
        let room_id = undefined;
        let comments = [];
        let data = req.body;
        if (data.hasOwnProperty('room_id')) room_id = data.room_id;
        if (data.hasOwnProperty('comments')) comments = data.comments;
        let channel_info = await db.collection('channel').findOne({bilibili_live_room: room_id});
        let uid = channel_info.bilibili_uid;
        let comments_by_date = {};
        //按日期区分
        comments.forEach(comment => {
            let date = formatDate(comment.time);
            if (!comments_by_date.hasOwnProperty(date))
                comments_by_date[date] = [];
            comments_by_date[date].push(comment);
        });
        for (let comment_date in comments_by_date) {
            let name = uid.toString() + '_' + comment_date;
            let comment_in_that_date = await db.collection('off_comments').countDocuments({name: name});
            if (comment_in_that_date === 0) {
                //如果不存在，则直接添加
                await db.collection('off_comments').insertOne({name: name, comments: comments_by_date[comment_date]})
            } else {
                //否则插入到后面
                await db.collection('off_comments').updateOne({name: name}, {
                    $push: {
                        comments: {$each: comments_by_date[comment_date]}
                    }
                })
            }
        }
    } catch (e) {
        console.error(e);
        res.status(500);
        status = 1;
        res.send({status: status});
    } finally {
        if (status === 0) {
            res.send({status: 0})
        }
    }
});

function formatDate(date) {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;
    return year + month + day
}

module.exports = router;