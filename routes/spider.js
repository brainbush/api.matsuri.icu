const express = require('express');
const router = express.Router();
const cors = require('cors');
const Hashids = require('hashids/cjs');

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
    db.collection('channel').findOneAndUpdate({bilibili_uid: bilibili_uid},
        {
            $set: channel_set,
            $inc: {total_clips: 1}
        });
    db.collection('clip').insertOne({
        id: id,
        bilibili_uid: bilibili_uid,
        start_time: start_time,
        title: title,
        live: live,
        cover: cover
    });
    res.send({id: id})
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
    let id, end_time, total_danmu, highlights, full_comments;
    if (data.hasOwnProperty('id')) id = data.id;
    if (data.hasOwnProperty('end_time')) end_time = data.end_time;
    if (data.hasOwnProperty('total_danmu')) total_danmu = data.total_danmu;
    if (data.hasOwnProperty('highlights')) highlights = data.highlights;
    if (data.hasOwnProperty('full_comments')) full_comments = data.full_comments;
    let clip_info = await db.collection('clip').findOneAndUpdate({id: id},
        {$set: {end_time: end_time, total_danmu: total_danmu, highlights: highlights, full_comments: full_comments}});
    let bilibili_uid = clip_info.value.bilibili_uid;
    db.collection('channel').findOneAndUpdate({bilibili_uid: bilibili_uid},
        {
            $set: {is_live: false, last_danmu: total_danmu},
            $inc: {total_danmu: total_danmu}
        });
    res.send({status: 0})
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
            {$set: {name: channel.name, face: channel.face}})
    });
    res.send({status: 0})
});

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
            db.collection('channel').insertOne({
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