const express = require('express');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const methodOverride = require('method-override');
const { Server } = require("socket.io");
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

require('dotenv').config();

app.use(cors());

app.use(logger('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));


const indexRouter = require('./routes/index');
const apiRouter = require('./routes/api');

app.use((req, res, next) => {
    if (Object.keys(req.body).length) console.log('body: ', req.body);
    if (Object.keys(req.query).length) console.log('query: ', req.query);
    next();
})

app.use('/', indexRouter);
app.use('/api', apiRouter);

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('complete', (msg) => {
        socket.emit('complete', msg);
    })
});

mongoose.connect(`${process.env.DATABASE_URL}`, (err) => {
    const dbState = [{
        value: 0,
        label: "Disconnected"
    }, {
        value: 1,
        label: "Connected"
    }, {
        value: 2,
        label: "Connecting"
    }, {
        value: 3,
        label: "Disconnecting"
    }], state = mongoose.connection.readyState;

    // connected to db
    console.log(dbState.find(f => f.value == state).label + " database")
});

module.exports = app;