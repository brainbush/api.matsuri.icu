const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());


router.get('/:id', async (req, res) => {
    let status = 0;
    let id = req.params.id;
    let clip_info = {};
    const db = await req.app.locals.pg.connect();
    try {
        clip_info = await db.query('SELECT id, bilibili_uid, title, EXTRACT(EPOCH FROM start_time)*1000 AS start_time, EXTRACT(EPOCH FROM end_time)*1000 AS end_time, cover, danmu_density, total_danmu, total_gift, total_superchat, total_reward, highlights, viewers AS views FROM clip_info WHERE id = $1', [id])
        clip_info = clip_info.rows[0]
        let mid = clip_info.bilibili_uid;
        let channel_info = await db.query('SELECT name FROM channels WHERE bilibili_uid = $1', [mid]);
        clip_info.name = channel_info.rows[0].name;
    } finally {
        db.release()
        res.send({status: status, data: clip_info})
    }
});

router.get('/:id/comments', async (req, res) => {
    let status = 0;
    let id = req.params.id;
    let full_comments;
    const db = await req.app.locals.pg.connect();
    try {
        let r = await db.query('SELECT EXTRACT(EPOCH FROM "time")*1000 as time, username, user_id, superchat_price, gift_name, gift_price, gift_num, "text" FROM comments WHERE clip_id = $1 ORDER BY "time"', [id])
        full_comments = r.rows
        await full_comments.forEach(comment=>Object.keys(comment).forEach((k) => comment[k] == null && delete comment[k]))
    } finally {
        db.release()
        res.send({status: status, data: full_comments})
    }
});

module.exports = router;
