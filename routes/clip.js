const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());



router.get('/:id', async (req, res) => {
    let status = 0;
    let id = req.params.id;
    let clip_info;
    let clip_detail;
    try {
        const db = req.app.locals.db;
        clip_info = await db.collection('clip').findOne({id: id}, {projection: {_id: 0}});
        let mid = clip_info.bilibili_uid;
        let channel_info = await db.collection('channel').findOne({bilibili_uid: mid}, {projection: {_id: 0}});
        clip_info.name = channel_info.name;
        clip_detail = {highlights: clip_info.highlights, full_comments: clip_info.full_comments};
        delete clip_info.highlights;
        delete clip_info.full_comments
    } finally {
        res.send({status: status, data: {clip_info, clip_detail}})
    }
});

module.exports = router;
