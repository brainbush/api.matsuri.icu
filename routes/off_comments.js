const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());
const db = require('../db');

router.get('/:mid/:date', async (req, res) => {
    let status = 0;
    let mid = req.params.mid;
    let date = req.params.date;
    let full_comments = [];
    let format_date = new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)} 0:0:0`).getTime() / 1000
    try {
        let r = await db.query('SELECT EXTRACT(EPOCH FROM "time")*1000 as time, username, user_id, superchat_price, gift_name, gift_price, gift_num, "text" FROM off_comments WHERE liver_uid = $1 AND ("time" BETWEEN to_timestamp($2) AND to_timestamp($3)) ORDER BY "time"',
            [mid, format_date, format_date + 24 * 3600])
        full_comments = r.rows
        await full_comments.forEach(comment => Object.keys(comment).forEach((k) => comment[k] == null && delete comment[k]))
    } finally {
        res.send({status: status, data: {comments: full_comments}})
    }
});

module.exports = router;