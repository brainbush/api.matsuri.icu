const express = require('express');
const logger = require('morgan');

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

const indexRouter = require('./routes/index');
const channelRouter = require('./routes/channel');
const clipRouter = require('./routes/clip');
const spiderRouter = require('./routes/spider');
const viewerRouter = require('./routes/viewer');
const offCommentsRouter = require('./routes/off_comments');

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
console.log(`Authorization is:${process.env.Authorization}, Sentry dsn: ${process.env.SentryDSN}`);

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
