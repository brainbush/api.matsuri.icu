const express = require('express');
const router = express.Router();
const cors = require('cors');

router.all('*', cors());

router.get('/:mid/:date', async (req, res) => {
    let status = 0;
    let data = {};
    let mid = req.params.mid;
    let date = req.params.date;
    try {
        const db = req.app.locals.db;
        let name = mid + '_' + date;
        data = await db.collection('off_comments').findOne({name: name}, {projection: {_id: 0}});
    } finally {
        res.send({status: status, data: data})
    }
});

module.exports = router;