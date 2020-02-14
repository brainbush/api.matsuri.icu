const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
    res.send('<html lang="zh-cn"><head><title>anti了</title></head><body><h1>别骂了别骂了孩子要变成anti了</h1></body></html>');
});

module.exports = router;
