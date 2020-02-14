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
router.get('/:mid/clips/:kind', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let kind = req.params.kind;
    let list;
    try {
        let q;
        const db = req.app.locals.db;
        if (kind === 'all') {
            q = {bilibili_uid: mid};
        } else if (kind === 'online') {
            q = {bilibili_uid: mid, live: true};
        } else {
            q = {bilibili_uid: mid, live: false};
        }
        list = await db.collection('clip').find(q,
            {
                projection: {
                    _id: 0,
                    id: 1,
                    bilibili_uid: 1,
                    start_time: 1,
                    end_time: 1,
                    title: 1,
                    live: 1,
                    cover: 1,
                    total_danmu: 1,
                }
            }
        ).sort({start_time: -1}).toArray();
    } finally {
        res.send({status: status, data: list})
    }

});

module.exports = router;
