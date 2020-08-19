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

function check_origin(origin) {
    if (!origin) return false
    return origin.includes('matsuri.icu');
}

router.get('/:mid', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let origin = req.header('origin');
    if (!check_origin(origin)) {
        res.status(403)
        res.send({status: 1, message: '别看了别看了，真的别看了'})
        return
    }
    let comments;
    let final_list = null;
    try {
        const redis_client = req.app.locals.redis_client;
        let r = await redis_client.get('viewer_' + mid);
        if (r) final_list = JSON.parse(r);
        if (final_list === null) {
            final_list = []
            const db = req.app.locals.db;
            comments = await db.collection('clip').aggregate(
                [
                    {$match: {"full_comments.user_id": mid}},
                    {
                        $lookup: {
                            from: "channel",
                            localField: "bilibili_uid",
                            foreignField: "bilibili_uid",
                            as: "channel_info"
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            "id": 1,
                            "bilibili_uid": 1,
                            "start_time": 1,
                            "title": 1,
                            "cover": 1,
                            "danmu_density": 1,
                            "end_time": 1,
                            "total_danmu": 1,
                            "total_gift": 1,
                            "total_reward": 1,
                            "total_superchat": 1,
                            "views": 1,
                            channel_info: {
                                $arrayElemAt: ["$channel_info", 0]
                            },
                            full_comments: {
                                $filter: {
                                    input: "$full_comments",
                                    as: "comment",
                                    cond: {$eq: ["$$comment.user_id", mid]}
                                }
                            }
                        }
                    }
                ]).toArray();
            for (const clip of comments) {
                let k = {};
                clip.name = clip.channel_info.name;
                delete clip.channel_info
                k.full_comments = clip.full_comments;
                delete clip.full_comments
                k.clip_info = clip
                final_list.push(k)
            }
            final_list.sort(start_time_compare)
            if (final_list.length > 0) {
                redis_client.set('viewer_' + mid.toString(), JSON.stringify(final_list))
                redis_client.expire('viewer_' + mid.toString(), 43200)
            }
        }
    } finally {
        res.send({status: status, data: final_list})
    }
});

module.exports = router;