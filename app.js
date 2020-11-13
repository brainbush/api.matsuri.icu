const express = require('express');
const logger = require('morgan');
const MongoClient = require('mongodb').MongoClient;
const redis = require('async-redis');

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

const indexRouter = require('./routes/index');
const channelRouter = require('./routes/channel');
const clipRouter = require('./routes/clip');
const spiderRouter = require('./routes/spider');
const viewerRouter = require('./routes/viewer');
const offCommentsRouter = require('./routes/off_comments');

const mongo_url = 'mongodb://localhost:27017/';
const mongo_options = {
    useUnifiedTopology: true,
    auto_reconnect: true,
    poolSize: 20,
    connectTimeoutMS: 60000,
    serverSelectionTimeoutMS: 5000
};
const db_name = 'matsuri_icu';

const app = express();

Sentry.init({
    dsn: process.env.SentryDSN,
    integrations: [
        new Sentry.Integrations.Http({tracing: true}),
        new Tracing.Integrations.Express({app}),
    ],
    tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(Sentry.Handlers.errorHandler());

MongoClient.connect(mongo_url, mongo_options, (err, client) => {
        if (err) throw err;
        console.log(`DB connected, Authorization is:${process.env.Authorization}, Sentry dsn: ${process.env.SentryDSN}`);
        app.locals.db = client.db(db_name);
    }
).then(() => {
});
app.locals.redis_client = redis.createClient();

// noinspection JSCheckFunctionSignatures
app.use(logger("short"));
app.use(express.json({limit: '500mb'}));
app.use(express.urlencoded({extended: false}));

app.use('/', indexRouter);
app.use('/channel', channelRouter);
app.use('/clip', clipRouter);
app.use('/spider', spiderRouter);
app.use('/viewer', viewerRouter);
app.use('/off_comments', offCommentsRouter);

module.exports = app;
