const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());


//所有频道列表
router.get('/', async (req, res) => {
    let status = 0;
    let channels = null;
    try {
        const db = req.app.locals.db;
        channels = await db.collection('channel').find({}, {projection: {_id: 0}}).toArray();
    } finally {
        res.send({status: status, data: channels});
    }
});

//单个频道用户基本信息
router.get('/:mid', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let channel = {};
    try {
        const db = req.app.locals.db;
        channel = await db.collection('channel').findOne({bilibili_uid: mid}, {projection: {_id: 0}})
    } finally {
        res.send({status: status, data: channel});
    }
});

//单个频道所有clip
router.get('/:mid/clips', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let list = null;
    try {
        const redis_client = req.app.locals.redis_client;
        let r = await redis_client.get('channel_' + mid);
        if (r) list = JSON.parse(r);
        if (list === null) {
            const db = req.app.locals.db;
            list = await db.collection('clip').find({bilibili_uid: mid},
                {
                    projection: {
                        _id: 0,
                        full_comments: 0,
                        highlights: 0
                    }
                }
            ).toArray();
            list = list.reverse()
            if (list.length > 0) {
                redis_client.set('channel_' + mid.toString(), JSON.stringify(list))
            }
        }
    } finally {
        res.send({status: status, data: list})
    }
});

module.exports = router;
