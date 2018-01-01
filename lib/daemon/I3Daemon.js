const
    net = require('net'),
    lpc = require('lpc');

const
    ServiceMap = {
        "emoteto": "onEmoteTo",
        "locate-req": "onLocateRequest",
        "finger-req": "onFingerRequest",
        "mudlist": "onReceiveMudlist",
        "startup-reply": "onStartupReply",
        "tell": "onTellMessage",
        "who-req": "onWhoRequest"
    };

const
    _address = '_address',
    _daemon = '_daemon',
    _mudlist = '_mudlist',
    _password = '_password',
    _port = '_port',
    _socket = '_socket',
    _id = '_id';

class I3MUDEntry {
    constructor(name, data) {
        /** @type {number} */
        this.name = name;

        /** @type {number} */
        this.state = data[0];

        /** @type {string} */
        this.ipAddress = data[1];

        /** @type {number} */
        this.playerPort = data[2];

        /** @type {number} */
        this.imudTcpPort = data[3];

        /** @type {number} */
        this.imudUdpPort = data[4];

        /** @type {string} */
        this.mudlib = data[5];

        /** @type {string} */
        this.baseMudlib = data[6];

        /** @type {string} */
        this.driver = data[7];

        /** @type {string} */
        this.mudType = data[8];

        /** @type {string} */
        this.openStatus = data[9];

        /** @type {string} */
        this.adminEmail = data[10];

        /** @type {Object.<string,boolean>} */
        this.services = data[11];

        /** @type {Object.<string,any>} */
        this.xtraInfo = data[12];
    }
}

class I3RouterEntry {
    /**
     * Constructs a new router entry.
     * @param {any[]} packet
     */
    constructor(packet) {
        this.channelListId = 0;
        this.mudListId = 0;
        this.$socket = null;

        if (Array.isArray(packet)) {
            this.id = packet[0];
            let [address, port] = packet[1].split(' ', 2);
            this.address = address;
            this.password = 0;
            this.port = parseInt(port);
        }
        else if (typeof packet === 'object') {
            this.id = packet.id;
            this.address = packet.address;
            this.channelListId = packet.channelListId || 0;
            this.mudListId = packet.mudListId || 0;
            this.port = packet.port;
            this.password = packet.password || 0;
        }
    }

    /**
     * 
     * @param {I3RouterEntry} router
     */
    eq(router) {
        if (typeof router !== 'object')
            return false;

        return (router.id === this.id &&
            router.address === this.address &&
            router.port === this.port);
    }

    get parser() {
        let parser = this.$parser;
        if (!parser) {
            parser = this.$parser = new lpc.LPCParser();
        }
        return parser;
    }

    /**
     * Send a message to the router if connected.
     * @param {any[]} packet The data to transmit.
     */
    sendMessage(packet) {
        if (this.$socket && this.$socket.readyState === 'open') {
            this.$socket.write(this.parser.wireFormat(packet));
        }
    }
}

class I3Daemon extends MUDObject {
    create() {
        if (efuns.featureEnabled('intermud3')) {
            if (!efuns.restoreObject(`${__dirname}/save/I3Daemon`)) {
                this.addRouter({
                    id: '*kmud',
                    address: efuns.mudInfo().serverAddress,
                    port: 8787
                });
            }
        }
        this.initialize();
    }

    /**
     * 
     * @param {I3MUDEntry} mud
     */
    addMud(mud) {
        var mudList = this.mudList;
        mudList[mud.name] = mud;
    }

    /**
     * Adds a new router.
     * @param {I3RouterEntry} router
     */
    addRouter(router) {
        /**
         * @type {I3RouterEntry[]}
         */
        let routers = this.getProtected('routerList', {}),
            exists = routers[router.id];

        if (!exists) {
            this.routers[router.id] = new I3RouterEntry(router);
            efuns.saveObject('save/I3Daemon');
        }
    }

    /**
     * Return a specific MUD from the list of known MUDs.
     * @param {any} name The name of the MUD to retrieve
     * @return {I3MUDEntry} The desired MUD
     */
    getMud(name) {
        let p = efuns.previousObject(), t = efuns.thisObject();
        var muds = this.mudList;
        return muds[name] || false;
    }

    /**
     * @returns {string[]} A list of known MUDs.
     */
    getMudList() {
        var mudList = this.mudList;
        return Object.keys(mudList)
            .sort()
            .map(name => mudList[name]);
    }

    /**
     * @returns {string[]}
     */
    getMudNames() {
        return Object.keys(this.mudList).sort();
    }

    /**
     * @type {I3MUDEntry[]} All of the known MUDs.
     */
    get mudList() {
        return this.getProtected('mudList', []);
    }

    getRouter(id) {
        return this.routers[id] || false;
    }

    get routers() {
        return this.getProtected('routerList', {});
    }

    get parser() {
        let result = this.getProtected('$parser');
        if (!result) {
            this.setProtected('$parser', result = new lpc.LPCParser());
        }
        return result;
    }

    initialize() {
        if (efuns.featureEnabled('intermud3')) {
            let self = this,
                buffer = new Buffer(0),
                routers = this.routers;

            /**
             * 
             * @param {any} id
             * @param {I3RouterEntry} router
             */
            function connectRouter(id, router) {
                var socket = new net.Socket();

                socket.on('connect', (buffer) => {
                    console.log('I3 Daemon is connected');
                    this.startup(router);
                });
                socket.on('end', (e) => {
                    console.log(`I3 Daemon Connection to ${router.address}:${router.port} was closed; Reconnecting in 60 seconds.`);
                    setTimeout(() => {
                        connectRouter.call(this, id, router);
                    }, 60000)
                    try { socket.destroy(); }
                    catch (x) { }
                })
                socket.on('data', (_buffer) => {
                    try {
                        buffer = Buffer.concat([buffer, _buffer]);
                        var totalLen = buffer.length, ptr = 0;
                        var dataLen = (buffer[ptr] << 24) | (buffer[ptr + 1] << 16) | (buffer[ptr + 2] << 8) | buffer[ptr + 3];

                        //  do we have the complete message yet?
                        if (buffer.length < dataLen) {
                            //  nope
                            return;
                        }
                        var line = new Buffer(buffer.slice(ptr + 4, ptr + dataLen + 4)).toString('ascii'), resp;
                        console.log('I3 Daemon Received: %s', line);

                        if (line.length === dataLen) {
                            var packet = this.parser.deserialize(line);

                            buffer = buffer.slice(4 + dataLen);

                            if (Array.isArray(packet) && packet.length > 3) {
                                var packetType = packet[0], fn = ServiceMap[packetType];
                                if (fn && typeof self[fn] === 'function') {
                                    self[fn].call(self, router, packet);
                                }
                                else {
                                    console.log("Unhandled I3 packet: " + JSON.stringify(packet));
                                }
                            }
                        }
                    }
                    catch (x) {
                        console.log(x);
                        // TODO: send error packet.
                    }
                });
                socket.on('error', (data) => {
                    console.log(`I3 Daemon Connection Error on ${router.address}:${router.port}: ${data}; Reconnecting in 30 seconds.`);
                    setTimeout(() => {
                        connectRouter.call(this, id, router);
                    }, 10000)
                    try { socket.destroy(); }
                    catch (x) { }
                });
                socket.on('timeout', (data) => {
                    console.log(`I3 Daemon Connection Timed Out on ${router.address}:${router.port}: ${data}; Reconnecting in 30 seconds.`);
                    setTimeout(() => {
                        connectRouter.call(this, id, router);
                    }, 30000)
                    try { socket.destroy(); }
                    catch (x) { }
                });
                let opts = {
                    port: router.port,
                    host: router.address
                };
                socket.connect(opts);
                router.$socket = socket;
            }

            Object.keys(routers).forEach((id, index) => {
                connectRouter.call(this, id, routers[id]);
            });
        }
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onEmoteTo(router, packet) {
        var player = efuns.findPlayer(packet[5]);
        if (player) {
            player.writeLine('%^CYAN%^{0}@{1} {2}%^RESET%^'.fs(packet[3], packet[2], packet[7]));
        }
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onFingerRequest(router, packet) {
        var self = this;

        FingerDaemon().eventIntermud3FingerRequest(packet[6], function (finger) {
            self.sendMessage([
                "finger-reply",
                5,
                packet[4],
                0,
                packet[2],
                packet[3],
                finger.name, /* visname */
                finger.displayTitle,
                finger.realName,
                finger.email,
                new Date().toDateString(), /* login logout time */
                finger.idleTime, /* idle time */
                0, /* ip name */
                finger.level,
                0
            ]);
        });
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onLocateRequest(router, packet) {
        var player = efuns.findPlayer(packet[6]);
        if (player) router.sendMessage([
            "locate-reply",
            5,
            efuns.mudName,
            0,
            packet[2],
            packet[3],
            efuns.mudName,
            player.displayName,
            -1,
            player.getTitle()
        ]);
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onReceiveMudlist(router, packet) {
        console.log('I3 Daemon received mudlist');
        var list = packet[7];
        Object.keys(list).forEach(mud => {
            var data = new I3MUDEntry(mud, list[mud]);
            this.mudList[mud] = data;
        });
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onStartupReply(router, packet) {
        console.log("I3 Daemon is on-line");

        if (Array.isArray(packet[6])) {
            let router = this.getRouter(packet[2]);
            if (router) {
                packet[6].forEach((a, i) => {
                    let router = new I3RouterEntry(a);
                });
                router.password = packet[7];
                efuns.saveObject('save/I3Daemon');
            }
        }
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onTellMessage(router, packet) {
        var player = efuns.findPlayer(packet[5]);
        if (player) {
            player.writeLine('%^RED%^{0}@{1} tells you%^RESET%^: {2}'.fs(packet[3], packet[2], packet[7]));
        }
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onWhoRequest(router, packet) {
        var _players = efuns.players().map((p, i) => {
            return [
                p.displayName,
                Math.round(p.idleTime / 1000),
                p.getTitle()
            ];
        });
        router.sendMessage([
            'who-reply',
            5,
            packet[4],
            0,
            packet[2],
            packet[3],
            _players
        ]);
    }

    /**
     * 
     * @param {any[]} socket The connected socket...
     * @param {I3RouterEntry} router The router to connect to
     */
    startup(router) {
        var parser = this.parser,
            info = efuns.mudInfo();

        router.sendMessage([
            'startup-req-3',
            5,
            efuns.mudName(),
            0,
            router.id,
            0,
            router.password,
            router.mudListId, /* old_mudlist_id */
            router.channelListId, /* old_chanlist_id */
            8000, /* player port */
            8888, /* imud_tcp_port */
            8889, /* imud_udp_port */
            info.mudlibVersion,
            info.mudlibBaseVersion, 
            info.gameDriver,
            'RPG', /* mud_type */
            'mudlib development',
            info.mudAdminEmail,
            //  Services
            {
                tell: 1,
                emoteto: 1,
                who: 1,
                finger: 1,
                locate: 1,
                channel: 1,
                news: 0,
                mail: 0,
                file: 0,
                auth: 1,
                ucache: 1
            },
            {
                architecture: info.architecture,
                hardware: info.hardware,
                memoryUsage: info.mudMemoryUsed,
                memoryTotal: info.mudMemoryTotal,
                systemMemUsed: info.systemMemoryUsed,
                systemMemTotal: info.systemMemoryTotal,
                "os build": info.osbuild,
                uptime: Math.floor(info.uptime / 1000),
                "web client address": 'http://thor:8080/'
            }
        ]);
    }

    setRouterList(data) {
        var routers = { length: 0 };
        Object.keys(data).forEach(function (id) {
            if (id.startsWith('*')) {
                routers[id] = new I3Router(data[id]);
                routers.length++;
            }
        });
        this.setProtected('routerList', routers);
    }
}

module.exports = { I3Daemon, I3RouterEntry, I3MUDEntry };

