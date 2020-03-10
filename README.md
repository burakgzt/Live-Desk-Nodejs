# Live-Desk-Nodejs

This is a NodeJs based live desk system for companies. It uses MongoDB as a database and Socket.IO for real-time chat sockets.

### Getting Started

Once you clone the project, you should first run  `npm install`  in the project directory to download dependencies, After that, you have to make configuration (explained below). When your configuration is ready, you can run  `node index.js`  to launch the server. By default, the server runs on port 3000, but you can change it. To see the app you can go  `http://localhost:3000` 

### Configuration

In project directory you will see the **.env** file. This file has the following content default:

    DB_URL=mongodb://localhost:27017
    DB_NAME=livesupport
    PORT=3000
    AUTHENTICATION_URL=http://localhost:3000/chat_token_check

You have to update DB_URL and DB_NAME parameters according to your MongoDB config. You may wish to change the port as you well. 

### Action Needed: Authentication
This project doesn't contain an authentication system by default. You have to implement it on your own or you should connect to existing service if it already exists. In `routes.js`  there is  `chat_token_check`route. It has hardcoded token check currently, you need to change it to use this system safely.



#### Link to my website
https://www.burakgozutok.com