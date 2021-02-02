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
    // let mid = parseInt(req.params.mid);
    let origin = req.header('origin');
    if (!check_origin(origin)) {
        res.status(403)
        res.send({status: 1, message: '别看了别看了，真的别看了'})
        return
    }
    let final_list = [];
    res.send({status: status, data: final_list})
});

module.exports = router;