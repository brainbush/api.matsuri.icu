const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());
const db = require('../db');

//所有频道列表
router.get('/', async (req, res) => {
    let status = 0;
    let channels = [];
    try {
        let data = await db.query('SELECT name, bilibili_uid, bilibili_live_room, is_live, last_danmu, total_clips, total_danmu, face, hidden, archive, EXTRACT(EPOCH FROM last_live)*1000 AS last_live from channels')
        channels = data.rows
    } finally {
        res.send({status: status, data: channels})
    }
});

//单个频道用户基本信息
router.get('/:mid', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let channel = {};
    try {
        let data = await db.query('SELECT name, bilibili_uid, bilibili_live_room, is_live, last_danmu, total_clips, total_danmu, face, hidden, EXTRACT(EPOCH FROM last_live)*1000 AS last_live from channels WHERE bilibili_uid= $1', [mid])
        if (data.rows.length >= 1) channel = data.rows[0];
    } finally {
        res.send({status: status, data: channel});
    }
});

//单个频道所有clip
router.get('/:mid/clips', async (req, res) => {
    let status = 0;
    let mid = parseInt(req.params.mid);
    let list = [];
    try {
        let data = await db.query('SELECT id, bilibili_uid, title, EXTRACT(EPOCH FROM start_time)*1000 AS start_time, EXTRACT(EPOCH FROM end_time)*1000 AS end_time, cover, total_danmu, viewers AS views FROM clip_info WHERE bilibili_uid= $1 ORDER BY start_time DESC', [mid])
        list = data.rows;
    } finally {
        res.send({status: status, data: list})
    }
});

module.exports = router;
