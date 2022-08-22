// These bots are working with www.legendmod.ml extension or agar.io
// version 1.3 version D
// creator Jimboy3100

// Url https://repl.it/@affanfals
// wss://party-bots-CleverBots--affanfals.repl.co

// By comparing Url and Websocket, imagine how your websocket should below
// If repl.it not loading, wait or make a new repo. Sometimes repl.it bugs

const WebSocket = require('ws'),
    { murmur2 } = require('murmurhash-js'),
    buffers = require('./buffers'),
    algorithm = require('./algorithm'),
    Reader = require('./reader'),
    Entity = require('./entity'),
    requester = require("request-promise"),
    logger = require("./logger.js"),
    config = require('./config.json');
	qs = require('querystring');

global.globalData=[];
global.globalDataCounter=0;
const userBots = [];
let userWS = null,
    stoppingBots = false,
    connectedBots = 0,
    spawnedBots = 0,
    serverPlayers = 0;

logger.warn('[SERVER]: If error occurs on port 1377 try 8083 on config.json and websocket');
if (config.server.update) {
    requester(config.server.link, (err, req, data) => {
        const requesterData = Buffer.from(data).toString()
        requesterConfig = JSON.parse(requesterData)

        if (config.server.version < requesterConfig.server.version) {
            logger.warn('[SERVER]: A new update was found!')
            logger.warn('[SERVER]: Download -> https://legendmod.ml/ExampleScripts/agario-bots2')
        } else {
            logger.good('[SERVER]: No updates found!')
        }
    })
} else {
    logger.error('[SERVER]: Update is false!')
}

logger.good(`[SERVER]: Running version ${config.server.version} on port ${config.server.port}`)

const game = {
    url: '',
    protocolVersion: 0,
    clientVersion: 0
}

const user = {
    ws: null,
    bots: [],
    startedBots: false,
    isAlive: false,
    mouseX: 0,
    mouseY: 0,
    offsetX: 0,
    offsetY: 0,
    macroFeedInterval: null,
	nick: ''
}

const bots = {
    name: '',
    amount: 0,
    ai: false,
    freeze: false,
	feedmode : false
}
const dataBot = {
    ws: null,
    buffersKey: 0,
    isConnected: false,
    playersAmount: 0,
    lastPlayersAmount: 0,
    connect() {
        this.buffersKey = 0
        this.isConnected = false
        this.playersAmount = 0
        this.lastPlayersAmount = 0
        this.ws = new WebSocket(game.url)
        this.ws.onopen = this.onopen.bind(this)
        this.ws.onmessage = this.onmessage.bind(this)
        this.ws.onclose = this.onclose.bind(this)
    },
    send(buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buffer)
    },
    onopen() {
        this.send(buffers.protocolVersion(game.protocolVersion))
        this.send(buffers.clientVersion(game.clientVersion))

    },
    onmessage(message) {
        if (this.buffersKey) message.data = algorithm.rotateBufferBytes(message.data, this.buffersKey)
        this.handleBuffer(message.data)
    },
    onclose() {
        if (this.isConnected) {
            this.isConnected = false
            this.connect()
            logger.error('[SERVER]: DataBot disconnected!')
        }
    },
    handleBuffer(buffer) {
        const reader = new Reader(buffer)
        switch (reader.readUint8()) {
            case 54:
                this.playersAmount = 0
                serverPlayers = 0;
                reader.byteOffset += 2
                while (reader.byteOffset < reader.buffer.byteLength) {
                    const flags = reader.readUint8()
                    if (flags & 2) reader.readString()
                    if (flags & 4) reader.byteOffset += 4
                    this.playersAmount++
                        serverPlayers++
                }
                this.lastPlayersAmount = this.playersAmount

                break
            case 241:
                this.buffersKey = reader.readInt32() ^ game.clientVersion
                this.isConnected = true
                logger.good('[SERVER]: DataBot connected!')
                break
        }
    }
}

function calculateDistance(botX, botY, targetX, targetY) {
    return Math.hypot(targetX - botX, targetY - botY)
}

function b64DecodeUnicode(str) {
	// Going backwards: from bytestream, to percent-encoding, to original string.
	return Buffer.from(str, 'base64').toString('utf-8');
	}
	
class Bot {
    constructor() {
        this.ws = null
        this.encryptionKey = 0
        this.decryptionKey = 0
        this.isConnected = false
        this.cellsIDs = []
        this.isAlive = false
		this.isNear = false
        this.followMouseTimeout = null
        this.followMouse = false
        this.gotCaptcha = false
        this.viewportEntities = {}
        this.offsetX = 0
        this.offsetY = 0
        this.connect()
		this.sp = false
    }
    reset() {
        this.encryptionKey = 0
        this.decryptionKey = 0
        this.isConnected = false
        this.cellsIDs = []
        this.isAlive = false
		this.isNear = false
        this.followMouseTimeout = null
        this.followMouse = false
        this.viewportEntities = {}
        this.offsetX = 0
        this.offsetY = 0
		this.sp = false
    }
    connect() {
        this.reset()
        this.ws = new WebSocket(game.url)
        this.ws.onopen = this.onopen.bind(this)
        this.ws.onmessage = this.onmessage.bind(this)
        this.ws.onerror = this.onerror.bind(this)
        this.ws.onclose = this.onclose.bind(this)
    }
    send(buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (this.encryptionKey) {
                buffer = algorithm.rotateBufferBytes(buffer, this.encryptionKey)
                this.encryptionKey = algorithm.rotateEncryptionKey(this.encryptionKey)
            }
            this.ws.send(buffer)
			//console.log(buffer)
        }
    }
    onopen() {
        this.send(buffers.protocolVersion(game.protocolVersion))
        this.send(buffers.clientVersion(game.clientVersion))
        this.isConnected = true
        connectedBots++
    }
    onmessage(message) {
        if (this.decryptionKey) message.data = algorithm.rotateBufferBytes(message.data, this.decryptionKey ^ game.clientVersion)
        this.handleBuffer(message.data)
    }
    onerror() {
        setTimeout(() => {
            if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) this.ws.close()
        }, 1000)
    }
    onclose() {
        if (this.isConnected) {
            this.isConnected = false
            connectedBots--
            //userWS.send(Buffer.from([4, connectedBots, spawnedBots, serverPlayers]))
            //if(!this.gotCaptcha) setTimeout(this.connect.bind(this), 1000)
        }
    }
	handletokens(){
				var temp;
				var i=0;
				if (global.globalData.length>300) i = global.globalData.length - 300
				for (;i<global.globalData.length;i++){
					if (global.globalData[i]) temp = i
				}
				if (global.globalData[temp]){
					this.send(buffers.spawn(bots.name,global.globalData[temp]))
					global.globalData[temp] = null
				}
				else{
					//this.send(buffers.spawn2(bots.name))
					//this.gotCaptcha = true
					if (userBots.includes(this)){
						userBots.splice(userBots.indexOf(this), 1)
						//userBots.push(new Bot()) 						
					}
					connectedBots--
					this.ws.onmessage = null
					this.reset()
					
				}	
	}
    handleBuffer(buffer) {
        const reader = new Reader(buffer)
        switch (reader.readUint8()) {			
            case 32:
                this.cellsIDs.push(reader.readUint32())
                if (!this.isAlive) {
                    this.isAlive = true
                    spawnedBots++
                    //userWS.send(Buffer.from([6, spawnedBots]))
                    if (!user.startedBots) {
                        setInterval(() => {
                            for (const bot of userBots) {
                                if (bot.isAlive) bot.move()
                            }
                        }, 40)
                        userWS.send(Buffer.from([0]))
                        user.startedBots = true
                        logger.good('[SERVER]: Bots started!')
                    }
                    if (!this.followMouseTimeout) {
                        this.followMouseTimeout = setTimeout(() => {
                            if (this.isAlive) this.followMouse = true
                        }, 72000)
                    }
                }
                break
            case 85:
                /*if (!user.startedBots) {
                    userWS.send(Buffer.from([3]))
                    setTimeout(process.exit, 1000)
                }*/
				if (userBots.includes(this)){
					userBots.splice(userBots.indexOf(this), 1)
                    userBots.push(new Bot())     
				}				
                this.gotCaptcha = true
                this.ws.onmessage = null
                this.reset()
                break
			case 102:
				//console.log('case 102')
                //this.handletokens()
                //break			
            case 241:
                this.decryptionKey = reader.readInt32()
                this.encryptionKey = murmur2(`${game.url.match(/(live-arena-\w+\.agar\.io)/)[1]}${reader.readString()}`, 255)
                this.isConnected = true
                break
            case 242:
				//console.log('case 242')
				this.handletokens()
                //this.send(buffers.spawn(bots.name))
                break
            case 255:
                this.handleCompressedBuffer(algorithm.uncompressBuffer(reader.buffer.slice(5), Buffer.allocUnsafe(reader.readUint32())))
                break
        }		
    }
    handleCompressedBuffer(buffer) {
        const reader = new Reader(buffer)
        switch (reader.readUint8()) {
            case 16:
                this.updateViewportEntities(reader)
                break
            case 64:
                this.updateOffset(reader)
                break
        }
    }
    updateViewportEntities(reader) {
        const eatRecordLength = reader.readUint16()
        for (let i = 0; i < eatRecordLength; i++) reader.byteOffset += 8
        while (true) {
            const id = reader.readUint32()
            if (id === 0) break
            const entity = new Entity()
            entity.id = id
            entity.x = reader.readInt32()
            entity.y = reader.readInt32()
            entity.size = reader.readUint16()
            const flags = reader.readUint8()
            const extendedFlags = flags & 128 ? reader.readUint8() : 0
            if (flags & 1) entity.isVirus = true
            if (flags & 2) reader.byteOffset += 3
            if (flags & 4) reader.readString()
            if (flags & 8) entity.name = decodeURIComponent(escape(reader.readString()))
            if (extendedFlags & 1) entity.isPellet = true
            if (extendedFlags & 4) reader.byteOffset += 4
            if (this.viewportEntities[entity.id] && this.viewportEntities[entity.id].name && entity.name) entity.name = this.viewportEntities[entity.id].name
            this.viewportEntities[entity.id] = entity
        }
        const removeRecordLength = reader.readUint16()
        for (let i = 0; i < removeRecordLength; i++) {
            const removedEntityID = reader.readUint32()
            if (this.cellsIDs.includes(removedEntityID)) this.cellsIDs.splice(this.cellsIDs.indexOf(removedEntityID), 1)
            delete this.viewportEntities[removedEntityID]
        }
        if (this.isAlive && this.cellsIDs.length === 0) {
            this.isAlive = false
            spawnedBots--
            //	userWS.send(Buffer.from([6, spawnedBots]))
            if (this.followMouseTimeout) {
                clearTimeout(this.followMouseTimeout)
                this.followMouseTimeout = null
            }
            this.followMouse = false
				this.handletokens()		
            //this.send(buffers.spawn(bots.name))
        }
    }
    updateOffset(reader) {
        const left = reader.readDouble()
        const top = reader.readDouble()
        const right = reader.readDouble()
        const bottom = reader.readDouble()
        if (~~(right - left) === 14142 && ~~(bottom - top) === 14142) {
            this.offsetX = (left + right) / 2
            this.offsetY = (top + bottom) / 2
        }
    }
	
	getClosestEntity(type, botX, botY, botSize) {
        let closestDistance = Infinity
        let closestEntity = null
        for (const entity of Object.values(this.viewportEntities)) {
            let isConditionMet = false
			//var str2 = entity.name;
			//if(str2.substring(0,3)=='|+|') console.log(entity.name);
            switch (type) {
				case 'biggerPlayer':
					isConditionMet =
						!entity.isVirus &&
						!entity.isPellet &&
						entity.size > botSize * 1.15 &&
						entity.name !== bots.name && entity.name !== user.nick;
					break;
				case 'pellet':
					isConditionMet = !entity.isVirus && entity.isPellet;
					break;
				case 'usercell':
					isConditionMet = entity.name == user.nick;
					break;
				case 'virus':
					isConditionMet = entity.isVirus && botSize > 126 && this.cellsIDs.length != 16;
					break;
				case 'upperhand':
					isConditionMet = !entity.isVirus && !entity.isPellet && entity.size * 1.15 < botSize;
					break;
			}
            if (isConditionMet) {
                const distance = calculateDistance(botX, botY, entity.x, entity.y)
                if (distance < closestDistance) {
                    closestDistance = distance
                    closestEntity = entity
                }
            }
        }
        return {
            distance: closestDistance,
            entity: closestEntity
        }
    }
    
	sendPosition(x, y){
		this.send(buffers.move(x, y, this.decryptionKey));
	}
    move() {
		const bot = {
            x: 0,
            y: 0,
            size: 0
        }
		var botcells=[];
		for (const id of this.cellsIDs) {
            const cell = this.viewportEntities[id]
            if (cell) {
                botcells.push(cell)
            }
        }
		var max_cells_size = Math.max.apply(Math,botcells.map(function(o){return o.size;}));
		var min_cells_size = Math.min.apply(Math,botcells.map(function(o){return o.size;}));
		var max_cells_x = Math.max.apply(Math,botcells.map(function(o){return o.x;}));
		var min_cells_x = Math.min.apply(Math,botcells.map(function(o){return o.x;}));
		var max_cells_y = Math.max.apply(Math,botcells.map(function(o){return o.y;}));
		var min_cells_y = Math.min.apply(Math,botcells.map(function(o){return o.y;}));
		var maxobj = botcells.find(function(o){return o.size == max_cells_size; });
		if(maxobj){
			bot.x = maxobj.x;
			bot.y = maxobj.y;
			bot.size = maxobj.size;
		}
		
        const closestBiggerPlayer = this.getClosestEntity('biggerPlayer', bot.x, bot.y, bot.size)	
		const closestVictimPlayer = this.getClosestEntity('upperhand', bot.x, bot.y, bot.size)
        const closestPellet = this.getClosestEntity('pellet', bot.x, bot.y, bot.size)
		const UserCell = this.getClosestEntity('usercell', bot.x, bot.y, bot.size);
		const closestVirus = this.getClosestEntity('virus', bot.x, bot.y, bot.size);
        
        
        if (user.isAlive) {
			if(UserCell.entity && (UserCell.distance - UserCell.entity.size - bot.size) < 4000){
			this.isNear=true;
			
			}
			if (this.followMouse && !stoppingBots && !bots.ai){
				if(bots.feedmode==false){
					if(this.isNear){
						if(bots.freeze){
							if(!this.sp){
								this.sendPosition(bot.x, bot.y);
								this.sp=true;
							}
						}
						else{
							this.sp=false;
							this.sendPosition(user.mouseX + this.offsetX, user.mouseY + this.offsetY);
						}
						
					}
					else {
						if (closestVirus.entity && (closestVirus.distance - closestVirus.entity.size - bot.size) < 133){
							const angle =
								(Math.atan2(
									closestVirus.entity.y - bot.y,
									closestVirus.entity.x - bot.x
								) +
									Math.PI) %
								(2 * Math.PI);
							this.send(
								buffers.move(
									14142 * Math.cos(angle),
									14142 * Math.sin(angle),
									this.decryptionKey
								)
							);
						}
						else if (closestBiggerPlayer.entity && (closestBiggerPlayer.distance - closestBiggerPlayer.entity.size - bot.size) < 320) {
							
							
							const angle =
								(Math.atan2(
									closestBiggerPlayer.entity.y - bot.y,
									closestBiggerPlayer.entity.x - bot.x
								) +
									Math.PI) %
								(2 * Math.PI);
							this.send(
								buffers.move(
									14142 * Math.cos(angle),
									14142 * Math.sin(angle),
									this.decryptionKey
								)
							);
						} 
						
						
						else if (closestVictimPlayer.entity && (closestVictimPlayer.distance - closestVictimPlayer.entity.size - bot.size) < 320){
							this.send(
								buffers.move(
									closestVictimPlayer.entity.x,
									closestVictimPlayer.entity.y,
									this.decryptionKey
								)
							);												
						}// End of AI Handling
						else if (closestPellet.entity){
							this.send(
								buffers.move(
									closestPellet.entity.x,
									closestPellet.entity.y,
									this.decryptionKey
								)
							);
						}
						else {
							const random = Math.random();
							const randomX = ~~(1337 * Math.random());
							const randomY = ~~(1337 * Math.random());
							if (random > 0.5)
								this.send(
									buffers.move(bot.x + randomX, bot.y - randomY, this.decryptionKey)
								);
							else
								this.send(
									buffers.move(bot.x - randomX, bot.y + randomY, this.decryptionKey)
								);
						}
						
					}
				}
				else{
					if(bots.freeze){
						if(!this.sp){
							this.sendPosition(bot.x, bot.y);
							this.sp=true;
						}
					}
					else{
						this.sp=false;
						this.sendPosition(user.mouseX + this.offsetX, user.mouseY + this.offsetY);
					}
				}
			}
			else {
				
				if (closestVirus.entity && (closestVirus.distance - closestVirus.entity.size - bot.size) < 133){
					const angle =
						(Math.atan2(
							closestVirus.entity.y - bot.y,
							closestVirus.entity.x - bot.x
						) +
							Math.PI) %
						(2 * Math.PI);
					this.send(
						buffers.move(
							14142 * Math.cos(angle),
							14142 * Math.sin(angle),
							this.decryptionKey
						)
					);
				}
				else if (closestBiggerPlayer.entity && (closestBiggerPlayer.distance - closestBiggerPlayer.entity.size - bot.size) < 320) {
					
					const angle =
						(Math.atan2(
							closestBiggerPlayer.entity.y - bot.y,
							closestBiggerPlayer.entity.x - bot.x
						) +
							Math.PI) %
						(2 * Math.PI);
					this.send(
						buffers.move(
							14142 * Math.cos(angle),
							14142 * Math.sin(angle),
							this.decryptionKey
						)
					);
				} 
				
				else if (closestVictimPlayer.entity && (closestVictimPlayer.distance - closestVictimPlayer.entity.size - bot.size) < 320){
					this.send(
						buffers.move(
							closestVictimPlayer.entity.x,
							closestVictimPlayer.entity.y,
							this.decryptionKey
						)
					);											
			}
				else if (closestPellet.entity){
					this.send(
						buffers.move(
							closestPellet.entity.x,
							closestPellet.entity.y,
							this.decryptionKey
						)
					);
				}
				else {
					const random = Math.random();
					const randomX = ~~(1337 * Math.random());
					const randomY = ~~(1337 * Math.random());
					if (random > 0.5)
						this.send(
							buffers.move(bot.x + randomX, bot.y - randomY, this.decryptionKey)
						);
					else 
						this.send(
							buffers.move(bot.x - randomX, bot.y + randomY, this.decryptionKey)
						);
				}
				
			}
		}
		else if(!user.isAlive && user.mouseX != 0 && bots.feedmode){//
			
			if(bots.freeze){
				if(!this.sp){
					this.sendPosition(bot.x, bot.y);
					this.sp=true;
				}
			}
			else{
				this.sp=false;
				this.sendPosition(user.mouseX + this.offsetX, user.mouseY + this.offsetY);
			}
				
			
		}

		else {
			if (closestVirus.entity && (closestVirus.distance - closestVirus.entity.size - bot.size) < 133){
				const angle =
					(Math.atan2(
						closestVirus.entity.y - bot.y,
						closestVirus.entity.x - bot.x
					) +
						Math.PI) %
					(2 * Math.PI);
				this.send(
					buffers.move(
						14142 * Math.cos(angle),
						14142 * Math.sin(angle),
						this.decryptionKey
					)
				);
			}
			else if (closestBiggerPlayer.entity && (closestBiggerPlayer.distance - closestBiggerPlayer.entity.size - bot.size) < 320) {
        const angle =
					(Math.atan2(
						closestBiggerPlayer.entity.y - bot.y,
						closestBiggerPlayer.entity.x - bot.x
					) +
						Math.PI) %
					(2 * Math.PI);
				this.send(
					buffers.move(
						14142 * Math.cos(angle),
						14142 * Math.sin(angle),
						this.decryptionKey
					)
				);
			} 
			
			
			else if (closestVictimPlayer.entity && (closestVictimPlayer.distance - closestVictimPlayer.entity.size - bot.size) < 320){
				this.send(
					buffers.move(
						closestVictimPlayer.entity.x,
						closestVictimPlayer.entity.y,
						this.decryptionKey
					)
				);												
			}
			else if (closestPellet.entity){
				this.send(
					buffers.move(
						closestPellet.entity.x,
						closestPellet.entity.y,
						this.decryptionKey
					)
				);
			}
			else {
				const random = Math.random();
				const randomX = ~~(1337 * Math.random());
				const randomY = ~~(1337 * Math.random());
				if (random > 0.5)
					this.send(
						buffers.move(bot.x + randomX, bot.y - randomY, this.decryptionKey)
					);
				else 
					this.send(
						buffers.move(bot.x - randomX, bot.y + randomY, this.decryptionKey)
					);
			}
			
		}
    }
}

new WebSocket.Server({
    port: config.server.port
}).on('connection', ws => {
    setInterval(() => {
        userWS.send(Buffer.from([4, connectedBots, spawnedBots]))
        userWS.send(Buffer.from([5, serverPlayers]))
    }, 1000);
    userWS = ws
    logger.good('[SERVER]: User connected!')
    ws.on('message', buffer => {
		if (JSON.parse(buffer.includes("message"))){
			var data = JSON.parse(buffer).msg;
			//console.log(JSON.parse(data))
			//console.log(Object.values(JSON.parse(data)))
			var temp = Object.values(JSON.parse(data))	
			global.globalDataCounter++;
			global.globalData[global.globalDataCounter]=temp.join("")
			//console.log("Captcha token " + global.globalDataCounter + " recieved")
			
                        if (dataBot.lastPlayersAmount < 195 && connectedBots < bots.amount && user.startedBots){
							userBots.push(new Bot())
						}
		}
		else{		
        const reader = new Reader(buffer)
        switch (reader.readUint8()) {
            case 0:
                if (!user.startedBots) {
                    game.url = reader.readString()
                    game.protocolVersion = reader.readUint32()
                    game.clientVersion = reader.readUint32()
                    user.isAlive = !!reader.readUint8()
					bots.name = reader.readString()
                    bots.amount = reader.readUint8()
					user.nick = reader.readString()
					user.nick = b64DecodeUnicode(user.nick)
                    dataBot.connect()
                    let index = 0
                    startBotsInterval = setInterval(() => {
                        if (dataBot.lastPlayersAmount < 195 && connectedBots < bots.amount && !stoppingBots) userBots.push(new Bot())
                    }, 150)
                    logger.good('[SERVER]: Starting bots...')
                }
                break
            case 1:
                if (user.startedBots && !stoppingBots) {
                    stoppingBots = true
                    ws.send(Buffer.from([1]))
                    let seconds = 0
                    setInterval(() => {
                        if (seconds === 1) {
                            ws.send(Buffer.from([2]))
                            setTimeout(process.exit, 1000)
                        } else {
                            logger.warn('[SERVER]: Stopping bots in ${1 - seconds} seconds')
                            seconds++
                        }
                    }, 1000)
                }
                break
            case 2:
				if(bots.feedmode==true){
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai) {
							bot.send(Buffer.from([17])) //sendSplit
							
						}
					}
					
				}
				else{
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai && bot.isNear) {
							bot.send(Buffer.from([17])) //sendSplit
							
						}
					}
					
				}
				break
            case 3:
				if(bots.feedmode==true){
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai) bot.send(Buffer.from([21])) //sendEject
					}
					
				}
				else{
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai && bot.isNear) bot.send(Buffer.from([21])) //sendEject
					}
					
				}
				break
				
            case 4:
                bots.ai = !!reader.readUint8()
                break
            case 5:
                user.isAlive = !!reader.readUint8()
                break
            case 6:
                user.mouseX = reader.readInt32()
                user.mouseY = reader.readInt32()
                break
			case 21:
				//split16
				if(bots.feedmode==true){
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai) {
							bot.send(Buffer.from([17])) //sendSplit
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 40);
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 80);
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 120);
							
						}
					}
					break
				}
				else{
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai && bot.isNear) {
							bot.send(Buffer.from([17])) //sendSplit
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 40);
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 80);
							setTimeout(function() {
								bot.send(Buffer.from([17]));
							}, 120);
							
						}
					}
					break
				}
			case 22:
				//reset bot.isNear status
				for (const bot of userBots) {
					bot.isNear = false;
				}
				break;
			case 23:
				//enable feedmode
				bots.feedmode = !!reader.readUint8();//true;
				break;
			case 24:
				//disable feedmode
				bots.feedmode = !!reader.readUint8();//false;
				break;
			case 25:
				//doubleSplit
				if(bots.feedmode==true){
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai) {
						bot.send(Buffer.from([17]));
						setTimeout(function() {
							bot.send(Buffer.from([17]));
						}, 40);
							
						}
					}
					break
				}
				else{
					for (const bot of userBots) {
						if (bot.isAlive && bot.followMouse && !stoppingBots && !bots.ai && bot.isNear) {
						bot.send(Buffer.from([17]));
						setTimeout(function() {
							bot.send(Buffer.from([17]));
						}, 40);
							
						}
					}
					break
				}
			case 26:
				//freeze
				bots.freeze = !!reader.readUint8();//false;
				break;
				
        }
		}
    })
	
	
    ws.on('close', () => {
        if (user.startedBots && !stoppingBots) {
            stoppingBots = true
            let seconds = 0
            setInterval(() => {
                if (seconds === 1) process.exit()
                else {
                    logger.warn('[SERVER]: Stopping bots in ${1 - seconds} seconds')
                    seconds++
                }
            }, 1000)
        }
        logger.error('[SERVER]: User disconnected!')
    })
})