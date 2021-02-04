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
    let final_list = [];
    try {
        let clips = await db.query('SELECT DISTINCT(clip_id) FROM comments WHERE user_id = $1', [mid])
        for (let clip of clips.rows) {
            let clip_id = clip.clip_id;
            let clip_info_query = await db.query('SELECT id, bilibili_uid, start_time, title, cover, danmu_density, end_time, total_danmu, total_gift, total_reward, total_superchat, viewers AS views FROM clip_info WHERE id = $1', [clip_id]);
            let clip_info = clip_info_query.rows[0];
            let channel_query = await db.query('SELECT name FROM channels WHERE bilibili_uid = $1', [clip_info.bilibili_uid]);
            clip_info.name = channel_query.rows[0].name;
            let r = await db.query('SELECT EXTRACT(EPOCH FROM "time")*1000 as time, username, user_id, superchat_price, gift_name, gift_price, gift_num, "text" FROM comments WHERE clip_id = $1 AND user_id = $2 ORDER BY "time"', [clip_id, mid])
            let full_comments = r.rows
            await full_comments.forEach(comment => Object.keys(comment).forEach((k) => comment[k] == null && delete comment[k]))
            final_list.push({clip_info: clip_info, full_comments: full_comments})
        }
    } finally {
        final_list.sort(start_time_compare)
        res.send({status: status, data: final_list})
    }
});

module.exports = router;