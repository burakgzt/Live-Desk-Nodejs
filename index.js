'use strict';

// brew services start mongodb-community
const express = require('express');
const http = require('http');
const io = require('socket.io');

const routeslib = require('./routes');
const socketlib = require('./socket');
const dblib = require('./db');
const dotenv = require('dotenv');


class Server {
    constructor() {
        dotenv.config();
        this.app = express();
        this.http = http.createServer(this.app);
        this.socket = io(this.http); 
        this.db = new dblib();

        this.app.use(express.static('public'))
        
    }
    //
    
    start() {                
        new routeslib(this.app,this.db).create();
        new socketlib(this.socket, this.db).create();

        const PORT = process.env.PORT || 3000;

        this.http.listen(PORT, () => {
            console.log('Listening on *:'+PORT);
        });
    }
}
const app = new Server();
app.start();