/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    net = await requireAsync('net'),
    lpc = await requireAsync('lpc');

const ServiceMap = {
    "auth-mud-req": "onAuthRequest",

    "channel-add": "onChannelAdd",
    "channel-admin": "onChannelAdmin",
    "channel-filter-req": "onChannelFilterRequest",
    "channel-filter-reply": "onChannelFilterReply",
    "channel-listen": "onChannelListen",
    "channel-m": "onChannelMessage",
    "channel-e": "onChannelEmote",
    "channel-remove": "onChannelRemove",
    "channel-t": "onChannelTargetedEmote",
    "channel-user-req": "onChannelUserRequest",
    "channel-user-reply": "onChannelUserReply",
    "channel-who-request": "onChannelWhoRequest",
    "channel-who-reply": "onChannelWhoReply",

    "emoteto": "onEmoteToRequest",
    "error": "onError",

    "finger-req": "onFingerRequest",
    "finger-reply": "onFingerReply",

    "locate-req": "onLocateRequest",
    "locate-reply": "onLocateReply",

    "startup-req-3": "onServerStartup",

    "tell": "onTellRequest",

    "who-req": "onWhoRequest",
    "who-reply": "onWhoReply",

};

class I3Channel {
    constructor(data) {
        this.name = data.name;
        this.hostMud = data.hostMud;
        this.channelType = data.channelType;
        this.subscribers = [];
    }

    addChannel (name, host, type) {
        var ch = new I3Channel({ name: name, hostMud: host, channelType: type });
        return this;
    }

    /**
     * @param {string} ch The channel to find.
     * @returns {I3Channel} The channel object.
     */
    getChannel(ch) {
        return _channels[ch];
    }

    getChannels() {
        let result = {};
        for (let ch in _channels) {
            result[ch] = _channels[ch].serialize();
        }
        return result;
    }

    updateSubscription(mudName, listening) {
        var mud = I3MUD.getMud(mudName);
        var i = this.subscribers.indexOf(mud);

        if (i === -1 && listening) this.subscribers.push(mud);
        else if (i > -1 && !listening) this.subscribers.splice(i, 1);
        return this;
    }

    serialize() {
        return [this.hostMud, this.channelType];
    }
}

class I3MUD {
    constructor(req, pass) {
        this.$socket = null;
        if (Array.isArray(req)) {
            /** @type {string} */
            this.name = req[2];

            /** @type {number} */
            this.password = req[6] || pass;

            /** @type {number} */
            this.oldMudListId = req[7];

            /** @type {number} */
            this.oldChannelListId = req[8];

            /** @type {number} */
            this.playerPort = req[9];

            /** @type {number} */
            this.tcpPort = req[10];

            /** @type {number} */
            this.udpPort = req[11];

            /** @type {string} */
            this.mudlib = req[12];

            /** @type {string} */
            this.baseMudlib = req[13];

            /** @type {string} */
            this.driver = req[14];

            /** @type {string} */
            this.mudType = req[15];

            /** @type {string} */
            this.openStatus = req[16];

            /** @type {string} */
            this.adminEmail = req[17];

            /** @type {Object.<string,any>} */
            this.services = req[18];

            /** @type {Object.<string,any>} */
            this.otherData = req[19];
        }
        this.sessions = {};
        this.state = -1;
    }

    createNewSession(mudName) {
        var timeInSectonds = Math.floor(new Date() / 1000),
            session = this.sessions[mudName];

        if (!session || session.expires < timeInSectonds) {
            session = (function (t) {
                return { id: efuns.createRandomValue(128), expires: t + 600 };
            })(timeInSectonds);
        }
        return (this.sessions[mudName] = session);
    }

    getMudListEntry() {
        return [
            this.state,
            this.address || '<unknown ip>',
            this.playerPort,
            this.tcpPort,
            this.udpPort,
            this.mudlib,
            this.baseMudlib,
            this.driver,
            this.mudType,
            this.openStatus,
            this.adminEmail,
            this.services,
            this.otherData
        ];
    }

    getSession(mudName) {
        var sessionId = this.sessions[mudName] || false;
        return sessionId;
    }

    get parser() {
        let parser = this.$parser || false;
        if (!parser) {
            parser = this.$parser = new lpc.LPCParser();
        }
        return parser;
    }

    sendMessage(packet) {
        if (this.$socket && this.$socket.readyState === 'open') {
            try {
                let message = this.parser.wireFormat(packet);
                logger.log('I3 Router Sending: %s', packet[0]);
                this.$socket.write(message);
            }
            catch (_e) {
                logger.log('I3 Router: Failure to send packet: %s', _e);
                logger.log(_e.stack);
            }
            return this;
        }
    }
}

class I3Router extends MUDObject {
    private get $server() {
        return get(undefined);
    }

    private set $server(server) {
        if (typeof server === 'object')
            set(server);
    }


    /** @type {string} */
    get address() {
        let addr = efuns.mudInfo().serverAddress;
        return get(addr);
    }

    protected set address(addr) {
        if (typeof addr === 'string')
            set(addr);
    }

    get channels() {
        return Object.assign({}, get({}));
    }

    protected set channels(channelList) {
        if (typeof channelList === 'object')
            set(channelList);
    }

    /** @type {Object.<string,I3MUD>} */
    get mudList() {
        return Object.assign({}, get({}));
    }

    protected set mudList(list) {
        if (typeof list === 'object')
            set(list);
    }

    get mudListVersion() {
        return get(0);
    }

    protected set mudListVersion(n) {
        if (typeof n === 'number' && n > this.mudListVersion)
            set(n);
    }

    get port() {
        return get(8787);
    }

    protected set port(p) {
        if (typeof p === 'number' && p > 1024)
            set(p);
    }

    get routerName() {
        return get('*kmud');
    }

    protected set routerName(name) {
        if (typeof name === 'string' && name.length > 3 && name.startsWith('*'))
            set(name);
    }

    private async create() {
        master().on('ready', async () => {
            try {
                if (!await efuns.restoreObjectAsync(`${__dirname}/save/I3Router`)) {
                    I3Channel.addChannel('node', this.routerName, 0);
                    efuns.saveObject('save/I3Router');
                }

                if (!this.routerName.startsWith('*'))
                    throw 'Illegal I3 Router ID';

                let server = net.createServer(socket => {
                    logger.log(`I3 Router ${this.routerName} received new connection.`);
                    let buffer = Buffer.alloc(0);
                    try {
                        socket.on('error', () => true);
                        socket.on('close', () => {
                            var mud = socket.mud;
                            if (mud) {
                                mud.state = 0;
                                mud.$socket = null;
                            }
                        });
                        socket.on('data', async (_buffer) => {
                            logger.log(`I3 Router Received ${_buffer.length} byte(s) of data ${_buffer.toString('utf8')}`);
                            let dataLen = -1;

                            try {
                                buffer = Buffer.concat([buffer, _buffer]);
                                let ptr = 0

                                try {
                                    dataLen = (buffer[ptr] << 24) | (buffer[ptr + 1] << 16) | (buffer[ptr + 2] << 8) | buffer[ptr + 3];
                                    let line = buffer.slice(ptr + 4, ptr + dataLen + 4).toString('utf8');

                                    //  do we have the complete message yet?
                                    if (buffer.length < dataLen) {
                                        //  nope
                                        return;
                                    }

                                    //logger.log('I3 Router Received: %s', line);

                                    if (line.length === dataLen && line.length > 0) {
                                        let request = this.$parser.deserialize(line);

                                        if (Array.isArray(request) && request.length > 4) {
                                            var packetType = request[0];

                                            if (typeof packetType !== 'string')
                                                throw 'Invalid packet received';

                                            if (ServiceMap[packetType]) {
                                                let handler = this[ServiceMap[packetType]];
                                                if (typeof handler === 'function') {
                                                    if (efuns.isAsync(handler)) {
                                                        await this[ServiceMap[packetType]](socket.mud, request, socket);
                                                    }
                                                    else {
                                                        this[ServiceMap[packetType]](socket.mud, request, socket);
                                                    }
                                                }
                                            }
                                            else {
                                                logger.log(`I3 Router: Unhandled packet type: ${packetType}`);
                                            }
                                        }
                                        logger.log('I3 Done with request');

                                    }
                                    else {
                                        logger.log('Received bad datagram');
                                    }
                                }
                                catch (_x) {
                                    logger.log(_x);
                                    logger.log(_x.stack);
                                }
                                buffer = buffer.slice(4 + dataLen);
                            }
                            catch (x) {
                                logger.log(`Error parsing packet: ${x.message}`);
                                logger.log(x.stack);
                            }
                        });
                    }
                    catch (_error) {
                        logger.log('socket is dead');
                    }
                });
                this.$server = server;
                this.address = efuns.mudInfo().serverAddress;
                server.listen(this.port, '0.0.0.0', () => {
                    logger.log('I3 Router is running on %s %d', this.address, this.port);
                });
            }
            catch (err) {
                logger.log(`I3Router error: ${err.message}`);
            }
        });
    }

    destroy() {
        logger.log('I3 Router Shutting Down');
        let server = this.$server;

        if (server) {
            server.close(() => {
                logger.log('I3 Router Shutdown Complete');
            });
        }
        super.destroy();
    }

    /**
        * Returns a reference to the LPC parser object.
        * @returns {lpc.LPCParser} Returns the parser used to interpret LPC network traffic.
        */
    get $parser() {
        return get(new lpc.LPCParser());
    }

    private async createMUD(packet) {
        let mud = false;
        try {
            mud = new I3MUD(packet, efuns.createRandomValue(24));
            this.mudList[mud.name] = mud;
            this.mudListVersion = efuns.time.now;
            if (!await efuns.saveObjectAsync('save/I3Router'))
                console.log('Unable to save I3Router data');
        }
        catch (err) {
            mud = false;
        }
        return mud;
    }

    /**
     * Attempts to find a MUD in the router's collection
     * @param {String} name The name of the MUD to locate
     * @returns {I3MUD} Retrieve data about a particular MUD.
     */
    getMUD(name) {
        return this.mudList[name] || false;
    }

    /**
        * Look for changes in a MUD listing.
        * @param {I3MUD} mud The cached MUD to compare with
        * @param {Array} packet The latest startup request.
        * @returns {boolean} True if the MUD listing has changed false if it is the same.
        */
    hasListChange(mud, packet) {
        if (!mud) return true;
        if (mud.name !== packet[2]) return true;
        if (mud.password !== 0 && mud.password !== packet[6])
            throw 'I3 Security Violation';
        if (mud.playerPort !== packet[9]) return true;
        if (mud.tcpPort !== packet[10]) return true;
        if (mud.mudlib !== packet[12]) return true;
        if (mud.baseMudlib !== packet[13]) return true;
        if (mud.driver !== packet[14]) return true;
        if (mud.mudType !== packet[15]) return true;
        if (mud.openStatus !== packet[16]) return true;
        if (mud.adminEmail !== packet[17]) return true;

        if (typeof packet[18] === 'object') {
            for (var sn in packet[18]) {
                if (typeof mud.services !== 'object')
                    return true;
                if (mud.services[sn] !== packet[18][sn]) return true;
            }
        }
        else if (typeof mud.services === 'object') return true;

        return false;
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onAuthRequest(mud, packet) {
        var name = packet[2],
            mud = this.getMUD(name);

        if (mud) {
            var session = mud.createNewSession(packet[4]);
            return mud.sendMessage([
                "auth-mud-reply",
                5,
                name,
                0,
                packet[4],
                0,
                session.id
            ]);
        }
        return false;
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onChannelListen(mud, packet) {
        var mud = this.getMUD(packet[2]),
            channel = I3Channel.getChannel(packet[6]);

        if (mud && channel) {
            channel.updateSubscription(mud, packet[7]);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onEmoteToRequest(mud, packet) {
        var target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     * Remote MUD indicates an error with a previous message.
     * @param {I3MUD} mud
     * @param {any} packet
     */
    onError(mud, packet) {
        let target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onFingerReply(mud, packet) {
        var target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onFingerRequest(mud, packet) {
        var target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onLocateReply(mud, packet) {
        var target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onLocateRequest(mud, packet) {
        Object.keys(this.mudList).forEach((name) => {
            let target = this.getMUD(name);
            if (target !== mud) {
                target.sendMessage(packet);
            }
        });
    }

    /**
        * This method fires when a MUD is signalling that it is starting Intermud services.
        * @param {Socket} socket The bound socket to the MUD.
        * @param {Array} packet The startup packet
        * @param {I3MUD} mud The mud instance (if available)
        * @returns {I3Router} A reference to the I3 Router.
        */
    private async onServerStartup(mud, packet, socket) {
        if (mud) {
            //  something is fishy here...
            logger.log('... Got onServerStartup() for an already connected MUD...');
        }
        mud = this.getMUD(packet[2]);

        //  We have seen this MUD before, lets see if the password matches...
        if (mud && mud.password !== 0 && packet[6] !== mud.password) {
            //  If not but the address is the same AND the MUD is
        }

        if (!mud) {
            mud = await this.createMUD(packet);
        }
        else if (this.hasListChange(mud, packet)) {
            this.mudListVersion = efuns.time.now;
        }
        if (!mud)
            return;

        socket.mud = mud;
        mud.$socket = socket;

        mud.address = socket.remoteAddress;
        mud.state = -1;

        setTimeout(() => {
            this.sendMudlist();
        }, 5000);

        mud.sendMessage([
            "startup-reply",
            5,
            this.routerName,
            0,
            mud.name,
            0,
            [
                [
                    this.routerName, `${this.address} ${this.port}`
                ]
            ],
            mud.password
        ]);
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onTellRequest(mud, packet) {
        let target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onWhoReply(mud, packet) {
        let target = this.getMUD(packet[4]);
        if (target) {
            target.sendMessage(packet);
        }
    }

    /**
     *
     * @param {I3MUD} mud The MUD sending the packet.
     * @param {any[]} packet The request packet.
     */
    onWhoRequest(mud, packet) {
        var target = this.getMUD(packet[4]);

        if (target) {
            target.sendMessage(packet);
        }
    }

    sendMudlist() {
        let _list = this.mudList, mudlist = {};

        for (let k in _list) {
            mudlist[k] = _list[k].getMudListEntry();
        }
        for (let k in _list) {
            try {
                /** @type {I3MUD} */
                var mud = _list[k];

                if (mud.oldMudListId !== this.mudListVersion) {
                    mud.sendMessage([
                        "mudlist",
                        5,
                        this.routerName,
                        0,
                        mud.name,
                        0,
                        1,
                        mudlist
                    ]);
                    mud.oldMudListId = this.mudListVersion;
                }
            }
            catch (_) {
                /* do nothing */
            }
        }
    }

    /**
        * Send a reply message to a MUD.
        * @param {any} socket The socket the MUD is connected to.
        * @param {any} packet The packet of information to send the MUD.
        * @returns {I3Router} A reference to the router
        */
    sendReply(socket, packet) {
        try {
            var message = this.$parser.wireFormat(packet);
            logger.log('I3 Router Sending: %s', message.slice(4).toString('ascii'));
            socket.write(message);
        }
        catch (_e) {
            logger.log('I3 Router: Failure to send packet: %s', _e);
            logger.log(_e.stack);
        }
        return this;
    }
}

module.exports = {
    I3Router: await createAsync(I3Router),
    I3MUD
};
