
const
    net = require('net'),
    crypto = require('crypto'),
    lpc = require('lpc');

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

    "finger-req": "onFingerRequest",
    "finger-reply": "onFingerReply",

    "locate-req": "onLocateRequest",
    "locate-reply": "onLocateReply",

    "startup-req-3": "onServerStartup",

    "tell": "onTellRequest",

    "who-req": "onWhoRequest",
    "who-reply": "onWhoReply",

};

function createRandomValue(bs) {
    var result = 0, buffer = crypto.randomBytes(bs || 128);
    for (var i = 0, l = buffer.length; i < l; i += 4) {
        result ^= buffer.readInt32LE(i);
    }
    return result & 0xFFFFFFFF;
}

function getTimestamp32() {
    let t = (new Date().getTime()) / 1000;
    return Math.floor(t);
}

class I3Channel {
    constructor(data) {
        this.name = data.name;
        this.hostMud = data.hostMud;
        this.channelType = data.channelType;
        this.subscribers = [];
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

I3Channel.addChannel = function (name, host, type) {
    var ch = new I3Channel({ name: name, hostMud: host, channelType: type });
    return this;
};

/**
    * @param {string} ch The channel to find.
    * @returns {I3Channel} The channel object.
    */
I3Channel.getChannel = function (ch) {
    return _channels[ch];
}

I3Channel.getChannels = function () {
    var result = {};
    for (var ch in _channels) {
        result[ch] = _channels[ch].serialize();
    }
    return result;
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
                console.log('I3 Router Sending: %s', message.slice(4).toString('ascii'));
                this.$socket.write(message);
            }
            catch (_e) {
                console.log('I3 Router: Failure to send packet: %s', _e);
                console.log(_e.stack);
            }
            return this;
        }
    }
}

I3MUD.prototype.getMudListEntry = function () {
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
};
    
I3MUD.prototype.createNewSession = function (mudName) {
    var timeInSectonds = Math.floor(new Date() / 1000),
        session = this.sessions[mudName];

    if (!session || session.expires < timeInSectonds) {
        session = (function (t) {
            return { id: createRandomValue(128), expires: t + 600 };
        })(timeInSectonds);
    }
    return (this.sessions[mudName] = session);
}

I3MUD.prototype.getSession = function (mudName) {
    var sessionId = this.sessions[mudName] || false;
    return sessionId;
}

class I3Router extends MUDObject {
    create() {
        let answer = 42;
        if (!efuns.restoreObject(`${__dirname}/save/I3Router`)) {
            this.setProtected('mudList', {});
            this.setProtected('channels', {});
            this.setProtected('mudListVersion', 0);
            this.setProtected('port', 8787);
            this.setProtected('routerName', '*kmud');
            I3Channel.addChannel('node', this.routerName, 0);
            efuns.saveObject('save/I3Router');
        }
        this.setProtected('address', efuns.mudInfo().serverAddress);

        if (!this.routerName.startsWith('*'))
            throw new Error('Illegal I3 Router ID');

        var self = this, server = net.createServer((socket) => {
            console.log(`I3 Router ${self.routerName} received new connection.`);
            let buffer = new Buffer(0);
            try {
                socket.on('error', function () {
                    return true;
                });
                socket.on('close', function () {
                    var mud = socket.mud;
                    if (mud) {
                        mud.state = 0;
                        mud.$socket = null;
                    }
                });
                socket.on('data', function (_buffer) {
                    console.log('I3 Router Received Data');
                    try {
                        buffer = Buffer.concat([buffer, _buffer]);
                        var totalLen = buffer.length, ptr = 0;

                        try {
                            var dataLen = (buffer[ptr] << 24) | (buffer[ptr + 1] << 16) | (buffer[ptr + 2] << 8) | buffer[ptr + 3];

                            //  do we have the complete message yet?
                            if (buffer.length < dataLen) {
                                //  nope
                                return;
                            }

                            let line = new Buffer(buffer.slice(ptr + 4, ptr + dataLen + 4)).toString('ascii'), resp;
                            console.log('I3 Router Received: %s', line);

                            if (line.length === dataLen) {
                                let request = self.parser.deserialize(line);

                                if (Array.isArray(request) && request.length > 4) {
                                    var packetType = request[0];

                                    if (typeof packetType !== 'string')
                                        throw new Error('Invalid packet received');

                                    if (ServiceMap[packetType]) {
                                        let handler = self[ServiceMap[packetType]];
                                        if (typeof handler === 'function') {
                                            handler.call(self, socket.mud, request, socket);
                                        }
                                    }
                                    else {
                                        console.log(`I3 Router: Unhandled packet type: ${packetType}`);
                                    }
                                }
                                console.log('I3 Done with request');

                            }
                            else {
                                console.log('Received bad datagram');
                            }
                        }
                        catch (_x) {
                            console.log(_x);
                            console.log(_x.stack);
                        }
                        buffer = buffer.slice(4 + dataLen);
                    }
                    catch (x) {
                        console.log('Error parsing packet');
                        console.log(x.stack);
                    }
                });
            }
            catch (_error) {
                console.log('socket is dead');
            }
        });
        this.setPrivate('$server', server);
        server.listen(this.port, this.address, function () {
            console.log('I3 Router is running on %s %d', self.address, self.port);
        });
    }

    destroy() {
        console.log('I3 Router Shutting Down');
        var server = this.getPrivate('$server');
        if (server) {
            server.close(function () {
                console.log('I3 Router Shutdown Complete');
            });
        }
        super.destroy();
    }

    /**
        * Returns the address the router is listening on.
        * @type {string}
        */
    get address() {
        return this.getProtected('address');
    }

    get mudList() {
        return this.getProtected('mudList', {});
    }

    get mudListVersion() {
        return this.getProtected('mudListVersion', 0);
    }

    set mudListVersion(n) {
        this.setProtected('mudListVersion', n);
    }

    /**
        * Returns a reference to the LPC parser object.
        * @type {lpc.LPCParser}
        */
    get parser() {
        let parser = this.getProtected('$parser', false);
        if (!parser) {
            parser = new lpc.LPCParser();
            this.setProtected('$parser', parser);
        }
        return parser;
    }

    /**
        * Returns the port the router is listening on.
        * @type {number}
        */
    get port() {
        return this.getProtected('port');
    }

    get routerName() {
        return this.getProtected('routerName');
    }

    createMUD(packet) {
        let mud = false;
        try {
            mud = new I3MUD(packet, createRandomValue(24));
            this.mudList[mud.name] = mud;
            this.mudListVersion = getTimestamp32();
            efuns.saveObject('save/I3Router');
        }
        catch (err) {
            mud = false;
        }
        return mud;
    }

    /**
        * Attempts to find a MUD in the router's collection
        * @param {String} name The name of the MUD to locate
        * @returns {I3MUD}
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
            throw new Error('I3 Security Violation');
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
    onServerStartup(mud, packet, socket) {
        if (mud) {
            //  something is fishy here...
            console.log('... Got onServerStartup() for an already connected MUD...');
        }
        mud = this.getMUD(packet[2]);

        //  We have seen this MUD before, lets see if the password matches...
        if (mud && mud.password !== 0 && packet[6] !== mud.password) {
            //  If not but the address is the same AND the MUD is
        }

        if (!mud) {
            mud = this.createMUD(packet);
        }
        else if (this.hasListChange(mud, packet)) {
            this.mudListVersion = getTimestamp32();
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
        var _list = this.mudList, mudlist = {};

        for (var k in _list) {
            mudlist[k] = _list[k].getMudListEntry();
        }
        for (var k in _list) {
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
            var message = this.parser.wireFormat(packet);
            console.log('I3 Router Sending: %s', message.slice(4).toString('ascii'));
            socket.write(message);
        }
        catch (_e) {
            console.log('I3 Router: Failure to send packet: %s', _e);
            console.log(_e.stack);
        }
        return this;
    }
}

module.exports = { I3Router, I3MUD };

