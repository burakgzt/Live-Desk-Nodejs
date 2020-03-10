'use strict';
var request=require('request');
const CONSTANTS = require('./constants');

class Db {
	
	constructor(){
		this.mongo = require('mongodb').MongoClient
		var url = process.env.DB_URL;
		var DBNAME = process.env.DB_NAME;

		this.mongo.connect(url, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		  }, (err, client) => {
		  if (err) {
			console.error(err)
			return
		  } else {
			  this.db = client.db(DBNAME);
		  } 
		});
	}
	/**
	 * Retrieves userId from token
	 * @param token = token to check
	 * @param cType = agent/user
 	**/
	 checkToken(token,cType) {		 
		return new Promise( async (resolve, reject) => { 	
			var url = process.env.AUTHENTICATION_URL;
			
			var propertiesObject = { token:token,ctype:cType };
			request({url:url, qs:propertiesObject}, (err, response, body) => {
				if(!err && response.statusCode == 200) { 
					var result = JSON.parse(response.body);	
					//console.log("TOKENCHECK :",url,result);				
					if(result && result.valid && result.userId) {											
						var userId = result.userId;					
						var userName = result.userName ? result.userName : '???';				
						resolve({"userId":userId,"userName":userName});
						return;
					}
				}			
				reject("Error");
			});
			
		});		
	}
	
	/**
	 * Retrieves list of active chats
 	**/
	getActiveChats() {
		return new Promise( async (resolve, reject) => { 			
			this.db.collection("chats").find(
				{active:1},
				{sort:{$natural:-1}}, 
				function(error, result) {
					if(error) {
						reject(error);
					} else {
						result.toArray(function (err, items) {
							if(err) {
								reject(err);
							}
							resolve(items); 
						});						
					}
			});
		});
	}

	/**
	 * Creates record for user updates if exists.
	 * @param userId : Id of user.
	 * @param socketId : socketId that is created with socketio. 
	 * @param userType : userType (1=user,2=agent)
 	**/	
	setSocketId(userId, socketId, userType = CONSTANTS.utypes.user) {
		userId = parseInt(userId);
		userType = parseInt(userType);

		return new Promise( async (resolve, reject) => { 
			if(!this.db) {
				reject("NotConnected");
			} else {
				this.db.collection("users").updateOne(
					{ userId: userId,uType:userType },
					{ $set: { socketId: socketId,updatedAt:new Date() } },
					{ upsert: true }, 
					(error, result) => {
						if(error) {
							reject(error);
						} else {
							resolve(result);
						}
					}
				);
			}			
		});	
	}

	/**
	 * Fetch user Info
	 * @param socketId : socketId of user to fetch
 	**/	
	getUserInfoFromSocket(socketId) {
		return new Promise( async (resolve, reject) => { 
			if(!this.db) {
				reject("NotConnected");
			} else {
				this.db.collection("users").findOne(
					{ socketId:socketId },
					{sort:{$natural:-1}},
					(error, result) => {
						if(error) {
							reject(error);
						} else {
							if(result) {
								resolve(result);
							} else {
								reject("NotFound");
							}							
						}
					}
				);
			}			
		});	
	}	

	/**
	 * Create new chat record for user. Updates if there is already active chat.
	 * @param userId : Id of user to create chat.
	 * @param userName : name of user
 	**/	
	createNewChat(userId,userName="") {
		userId = parseInt(userId);
		return new Promise( async (resolve, reject) => { 
			this.db.collection("chats").updateOne(
				{ userId:userId, active:1 },
				{ $set: { updatedAt:new Date(),userName:userName } },
				{ upsert: true }, 
				(error, result) => {
					if(error) {
						reject(error);
					} else {
						//console.log("Chat created for user "+userId);
						if(result && result.matchedCount > 0) {
							resolve({isUpdate:true});
						} else {
							resolve({isUpdate:false});
						}
					}
				}
			);				
		});
	}

	/**
	 * Get active chat info of user.
	 * @param userId : Id of user
 	**/	
	getChatInfo(userId) {	
		userId = parseInt(userId);

		return new Promise( async (resolve, reject) => { 
			if(!this.db) {				
				reject("NotConnected");
			} else {
				this.db.collection("chats").findOne(
					{ userId:userId,active:1 },
					{sort:{$natural:-1}},
					(error, result) => {
						if(error) {							
							reject(error);
						} else {
							if(result) {
								resolve(result);
							} else {
								reject("NotFound");
							}							
						}
					}
				);
			}			
		});	
	}

	/**
	 * Terminates chat.
	 * @param userId : Id of user
 	**/
	terminateChat(userId) {
		return new Promise( async (resolve, reject) => { 
			this.db.collection("chats").updateOne(
				{ userId:userId,active:1 },
				{ $set: { active:0 } },
				{ upsert: false }, 
				(error, result) => {
					if(error) {
						reject(error);
					} else {
						if(result.matchedCount > 0) {
							resolve('Ok');
						} else {							
							reject("UserNotFound");
						}
						
					}
				}
			);
		});
	}
 
	/**
	 * Fetch user's information
	 * @param userId : Id of user
	 * @param userType : Type of person (agent or user)
 	**/	
	getUserInfoFromId(userId, userType= CONSTANTS.utypes.user) {
		userId = parseInt(userId);

		return new Promise( async (resolve, reject) => { 
			if(!this.db) {
				reject("NotConnected");
			} else {
				this.db.collection("users").findOne(
					{ userId:userId, uType: userType },
					{sort:{$natural:-1}},
					(error, result) => {
						if(error) {
							reject(error);
						} else {
							if(result) {
								resolve(result);
							} else {
								reject("NotFound");
							}							
						}
					}
				);
			}			
		});	
	}
	
	/**
	 * Connect agent to user's chat.
	 * @param agentId : Id of agent.
	 * @param userId : Id of user 
	 * @param agentName : Name of agent.
 	**/	
	connectAgentToUser(agentId, userId,agentName = "") {	
		agentId = parseInt(agentId);
		userId = parseInt(userId);
		
		return new Promise( async (resolve, reject) => { 		
			this.db.collection("chats").findOne(
				{ userId:userId,active:1 },
				(error, result) => {
					if(error) {
						reject(error);
					} else {
						if(result && result.agentId == agentId) {
							resolve({updated:false});
						} else {
							this.db.collection("chats").updateOne(
								{ userId:userId,active:1 },
								{ $set: { agentId: agentId,agentName:agentName, updatedAt:new Date() } },
								{ upsert: false }, 
								(error, result) => {
									if(error) {
										reject(error);
									} else {
										if(result.matchedCount > 0) {
											resolve({updated:true});											
										} else {							
											reject("UserNotFound");
										}
										
									}
								}
							);
						}							
					}
				}
			);

			
		});
	}

	/**
	 * Retrievets current messages of chat
	 * @param chatId : Id of chat.
 	**/
	getMessages(chatId) {
		return new Promise( async (resolve, reject) => { 			
			var messages = this.db.collection("messages").find({chat:chatId}, 
				function(error, result) {
					if(error) {
						reject(error);
					} else {
						result.toArray(function (err, items) {
							if(err) {
								reject(err);
							}
							resolve(items); 
						});						
					}
			});
		});
	}	
	
	/**
	 * Save message to database
	 * @param chatId : Id of chat.
	 * @param uType : Type of user 
	 * @param msg : Message to save.
 	**/	
	saveMessage(chatId, uType, msg) {
		return new Promise( async (resolve, reject) => { 			
			this.db.collection("messages").insertOne(
				{msg:msg,uType:uType,chat:chatId,date:new Date()}, 
				function(error, result) {
					if(error) {
						reject(error);
					} else {
						resolve("Ok");
					}
			  });
		});
	}
}
module.exports = Db;