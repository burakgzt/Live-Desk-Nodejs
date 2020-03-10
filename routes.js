'use strict';
class Routes {
    constructor(app,db) {
        this.app = app;
        this.db=db;
    }
    create() {
        this.app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });


        /**
         * @module /chat_token_check
         * TO DO: CURRENLTY HARD CODED TOKENS ARE EXISTS AND IT WILL CAUSE SECURITY ISSUES.
         * CHANGE method to validate tokens from remote service or database.
         */
        
        this.app.get('/chat_token_check', function(req, res){
            var token = req.query.token;
            if(token == "111111") {
                res.json({valid:true,userId:1,userName:"John Doe"});
            } else if(token == "222222") {
                res.json({valid:true,userId:2,userName:"Jane Doe"});
            } else if (token == "999999") {
                res.json({valid:true,userId:3,userName:"Agent Name"});
            } else {
                res.json({valid:false});
            }
        });

        /**
         * @module /
         * Home page: User's chat screen
         */
        this.app.get('/', function(req, res){
            res.sendFile(__dirname + '/index.html');
        });

        /**
         * @module /agent
         * Agent page: Agent's chat screen
         */
        this.app.get('/agent', function(req, res){
            //res.send('<h1>Hello world</h1>');
            res.sendFile(__dirname + '/index_agent.html');
        });

        /**
         * @module /chats
         * Get list of active chats ( for agents )
         */
        this.app.get('/chats', (req, res) => {
            var token = req.query.token;
            this.db.checkToken(token,2).then((data) => {
                this.db.getActiveChats().then(result => {	
                    res.json({"error":false,"chats":result});
                }).catch(err => res.json({"error":true}));
            }).catch(err => {
                res.json({"error":true});
            });	          
        });

        
    }

}
module.exports = Routes;