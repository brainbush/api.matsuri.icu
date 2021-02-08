const {Pool} = require('pg')
const pool = new Pool()
let types = require('pg').types

types.setTypeParser(types.builtins.NUMERIC, parseFloat)
types.setTypeParser(types.builtins.INT8, parseInt)
module.exports = {
    query: (text, params) => pool.query(text, params),
}
