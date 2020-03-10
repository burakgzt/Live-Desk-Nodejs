'use strict';

const CONSTANTS = require('./constants');



class Socket {	

    constructor(io,db) {
		this.io = io;
		this.db = db;
	}
	/**
 	* Send refuse Message to SocketId
 	*/
	refuseConnection(socketId) {
		this.io.to(socketId).emit('NewMessage', {error:true,errCode:500,msg:'Connection refused'});
	}

	/**
	 * Init Connection of current user.
	 * Create record in DB to match userId and socketId
	 * @param socket
 	**/
	initConnection (socket) {
		var cType = parseInt(socket.request._query['cType']);
		var token = socket.request._query['token'];
		

		if(cType == CONSTANTS.utypes.user || cType== CONSTANTS.utypes.agent) {
			this.checkToken(token, cType, socket);	
		} else {
			this.refuseConnection(socket.id);
		}							
	}	
	/**
	 * Retrieves userId from token
	 * @param token = token to check
	 * @param cType = agent/user
	 * @param socket
 	**/
	checkToken(token,cType,socket) {
		this.db.checkToken(token,cType).then((data) => {			
			this.db.setSocketId(data.userId,socket.id, cType).then(result => {				
				if(cType == CONSTANTS.utypes.user)
					this.createChat(socket.id,data.userName);
			}).catch(err => {
				this.refuseConnection(socket.id);
			});		
		}).catch(err => {
			this.refuseConnection(socket.id);
		});	
		
	}

	/**
	 * Sends message to given socketId	 
	 * @param socketId : socketId of Agent
	 * @param msg : Message to send.
	 * @param hasError : If it is error message or not.
	 * @param time : Time to display
 	**/
	 sendMessageToSocket(socketId, msg, sender, hasError=false, time=null) {
		if(!time) time = new Date();		
		let timeStr = (("0" + time.getHours()).slice(-2)   + ":" + ("0" + time.getMinutes()).slice(-2));
		
		this.io.to(socketId).emit('NewMessage', {error:hasError,msg:msg,from:sender,time:timeStr});			
	}

	/**
	 * finds and re-sends existing messages if there is an active chat exists.
	 * @param userId 
	 * @param socketId 
	 */
	getExistingMessages(userId,socketId) {
		this.db.getChatInfo(userId).then(result => {							
			this.db.getMessages(result._id).then(result => {	
				result.forEach((item) => {
					this.sendMessageToSocket(socketId, item.msg,item.uType,false,item.date);
				});
			}).catch(err => {});
		}).catch(err => {
		});	
	}

	/**
	 * Peek current chat get existing messages
	 * @param userId : Id of user
	 * @param socketId : socketId of Agent
 	**/
	 peekChat(userId,socketId) {	
		this.db.getUserInfoFromSocket(socketId).then(result => {																				
			this.getExistingMessages(userId,socketId);										
		}).catch(err => {
			this.refuseConnection(socketId);
		});
	}

	/**
	 * Connects agent to spefic user.
	 * then it sends Agent Connected message.
	 * @param userId = id of user
	 * @param agentName = name of the agent 
	 * @param socketId : socketId of Agent
 	**/
	 connectToUser(userId,agentName,socketId) {	
		this.db.getUserInfoFromSocket(socketId).then(result => {																
			this.db.connectAgentToUser(result.userId, userId, agentName).then(result => {			
				this.getExistingMessages(userId,socketId);				
				if(result && result.updated == true) {
					setTimeout(() => {
						this.sendServerMessage(socketId, userId, CONSTANTS.messages.AGENT_CONNECTED);
					},300);	
				}							
			}).catch(err => {
				this.refuseConnection(socketId);
			});			
		}).catch(err => {
			this.refuseConnection(socketId);
		});
	}

	/**
	 * Creates Chat for current user 
	 * then it sends Chat Started message.
	 * @param socketId : socketId of Agent
	 * @param userName : name of user
 	**/
	createChat(socketId,userName) {
		this.db.getUserInfoFromSocket(socketId).then(result => {							
			this.db.createNewChat(result.userId,userName).then(result2 => {
				this.getExistingMessages(result.userId,socketId);
				if(!result2.isUpdate) {
					setTimeout(() => {
						this.sendServerMessage(socketId, result.userId, CONSTANTS.messages.CHAT_STARTED);
					},300);									
				}				
			}).catch(err => {
				this.refuseConnection(socketId);
			});						
		}).catch(err => {
			console.log(err,socketId);
			this.refuseConnection(socketId);
		});		
	}
	/**
	 * Terminates Chat for current user 
	 * @param data : {to: receiverId} // IF caller is agent
	 * @param socketId : socketId of user/agent
 	**/
	 closeChat(socketId, data=null) {
		this.db.getUserInfoFromSocket(socketId).then(resultSender => {				
			var userId = (resultSender.uType == CONSTANTS.utypes.agent) ? data.to : resultSender.userId;			
			this.sendServerMessage(socketId,userId,CONSTANTS.messages.CHAT_END);	
			this.sendChatEndEvent(socketId,userId);			
			setTimeout(() => {
				this.db.terminateChat(userId).catch(err => {
					this.refuseConnection(socketId);
				});
			},3000);			
		}).catch(err => {
			this.refuseConnection(socketId);
		});			
	}


	/**
	 * Sends message to user
	 * @param userId : userId of receiver.
	 * @param uType : userType of receiver (agent=2 or user=1).
	 * @param msg : Message to send.
	 * @param sender : Sender's User Type.
 	**/
	 sendMessageToUser(userId,uType,msg, sender) {
		this.db.getUserInfoFromId(userId,uType).then(result => {				
			if(result && result.socketId) {
				this.sendMessageToSocket(result.socketId, msg, sender);			
			}														
		}).catch(err => {
			//console.log("NoPairFound for"+userId, uType);
		});
	}
	/**
	 * Sends custom event to user
	 * @param userId : userId of receiver.
	 * @param uType : userType of receiver (agent=2 or user=1).
	 * @param eventName : Name of event to send.
	 * @param val : Value of event.
	 * @param sender : Sender's User Type.
 	**/
	 sendEventToUser(userId,uType,eventName, val=null, sender=null) {
		this.db.getUserInfoFromId(userId,uType).then(result => {	
			if(result && result.socketId) {
				this.io.to(result.socketId).emit(eventName, {val:val,from:sender});			
			}														
		}).catch(err => {
			//console.log("NoPairFound for"+userId, uType);
		});
	}
	/**
	 * Sends chat end event to user (and agent if exists )
	 * @param socketId : socketId of client.
	 * @param userId : userId of client.
 	**/
	sendChatEndEvent(socketId,userId) {
		this.db.getChatInfo(userId).then(result => {										
			this.sendEventToUser(userId,CONSTANTS.utypes.user,"EndChat");			
			if(result.agentId) {
				this.sendEventToUser(result.agentId,CONSTANTS.utypes.agent,"EndChat");
			}			
		}).catch(err => {
			//this.refuseConnection(socketId);
		});		
	}
	/**
	 * Sends message from server to user (and agent if exists )
	 * @param socketId : socketId of client.
	 * @param userId : userId of client.
	 * @param msg : Message to send.
 	**/
	sendServerMessage(socketId, userId,msg) {
		this.db.getChatInfo(userId).then(result => {							
			this.db.saveMessage(result._id,CONSTANTS.utypes.server, msg).catch(err => {
				console.log(err);
			});
			
			this.sendMessageToUser(userId, CONSTANTS.utypes.user, msg, CONSTANTS.utypes.server);
			if(result.agentId) {
				this.sendMessageToUser(result.agentId, CONSTANTS.utypes.agent, msg, CONSTANTS.utypes.server);	
			}			
		}).catch(err => {
			console.log(err);
			this.refuseConnection(socketId);
		});		
	}

	
	/**
	 * Send message method that is called when user type something
	 * it first finds chat Information with socketId and save message to db.
	 * then emits socket event for both sender and receiver.
	 * @param data : {to: receiverId, msg: message} // IF sender is agent
	 * @param data : {msg: message} // IF sender is user
	 * @param socketId : socketId of sender
 	**/	
	sendMessage (data,socketId) {		
		if(data.msg === '') {
			this.sendMessageToSocket(socketId, CONSTANTS.messages.ENTER_MESSAGE, CONSTANTS.utypes.server, true);			
		} else {			
			this.db.getUserInfoFromSocket(socketId).then(resultSender => {				
				var userId = (resultSender.uType == CONSTANTS.utypes.agent) ? data.to : resultSender.userId;
 				this.db.getChatInfo(userId).then(result => {	
					this.db.saveMessage(result._id,resultSender.uType, data.msg).then(saveResult => {	
						if(resultSender.uType == CONSTANTS.utypes.agent) {						
							var pairId = result.userId;
							var pairUType = CONSTANTS.utypes.user;
						} else {
							var pairId = result.agentId;
							var pairUType = CONSTANTS.utypes.agent;
						}										
						this.sendMessageToSocket(socketId, data.msg, resultSender.uType);							
						this.sendMessageToUser(pairId, pairUType, data.msg, resultSender.uType);							
					}).catch(err => {
						this.refuseConnection(socketId);
					});					
				}).catch(err => {
					this.refuseConnection(socketId);
				});				
			}).catch(err => {
				this.refuseConnection(socketId);
			});									
		}		
	}


	/**
	 * Update writing status
	 * @param data : {to: receiverId, writing:boolean} // IF sender is agent
	 * @param data : {writing: boolean} // IF sender is user
	 * @param socketId : socketId of sender
 	**/	
	 setWritingStatus (data,socketId) {								
		this.db.getUserInfoFromSocket(socketId).then(resultSender => {				
			var userId = (resultSender.uType == CONSTANTS.utypes.agent) ? data.to : resultSender.userId;
			
			this.db.getChatInfo(userId).then(result => {	
				if(resultSender.uType == CONSTANTS.utypes.agent) {						
					var pairId = result.userId;
					var pairUType = CONSTANTS.utypes.user;
				} else {
					var pairId = result.agentId;
					var pairUType = CONSTANTS.utypes.agent;
				}				
				this.sendEventToUser(pairId,pairUType,"PairWriting",data.writing,resultSender.utype);											
			}).catch(err => {
				this.refuseConnection(socketId);
			});				
		}).catch(err => {
			this.refuseConnection(socketId);
		});											
	}

	/**
	 * Creates listeners for socket
	 **/
    create() {
        this.io.on('connection', (socket) => {
			this.initConnection(socket);			
			
			socket.on('ConnectUser', (data) => {				
				this.connectToUser(data.to,data.name,socket.id);
			});
			socket.on('WatchChat', (data) => {				
				this.peekChat(data.to,socket.id);
			});
			
			socket.on('Writing', (data) => {
				this.setWritingStatus(data,socket.id);
			});
            socket.on('SendMessage', (data) => {				
				this.sendMessage(data,socket.id);			  
			});
			socket.on('CloseChat', (data) => {			  
				this.closeChat(socket.id,data);
			});
            socket.on('disconnect', () => {
                //console.log('user disconnected');
            });
        });
    }    	
}
module.exports = Socket;