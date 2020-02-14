const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());

function start_time_compare(a, b) {
    if (a.clip_info.start_time < b.clip_info.start_time)
        return 1;
    if (a.clip_info.start_time > b.clip_info.start_time)
        return -1;
    return 0;
}

function time_compare(a, b) {
    if (a.time < b.time)
        return -1;
    if (a.time > b.time)
        return 1;
    return 0;
}

router.get('/:mid', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let comments;
    let final_list = [];
    try {
        const db = req.app.locals.db;
        comments = await db.collection('clip').aggregate(
            [
                {$match: {"full_comments.user_id": mid}},
                {$unwind: "$full_comments"},
                {$match: {"full_comments.user_id": mid}},
                {$group: {_id: "$id", full_comments: {$addToSet: "$full_comments"}}}
            ]).toArray();
        for (const clip of comments) {
            let k = {};
            let clip_info;
            clip_info = await db.collection('clip').findOne({id: clip._id}, {
                projection: {
                    _id: 0, full_comments: 0, highlights: 0
                }
            });
            let channel_info = await db.collection('channel').findOne({bilibili_uid: clip_info.bilibili_uid}, {projection: {_id: 0}});
            k.clip_info = clip_info;
            k.clip_info.name = channel_info.name;
            k.full_comments = clip.full_comments.sort(time_compare);
            final_list.push(k)
        }
        final_list.sort(start_time_compare)
    } finally {
        res.send({status: status, data: final_list})
    }
});

module.exports = router;