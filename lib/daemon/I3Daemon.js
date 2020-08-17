/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    net = require('net'),
    lpc = require('lpc');

const
    ServiceMap = {
        "emoteto": "onEmoteTo",
        "error": "onError",
        "locate-req": "onLocateRequest",
        "finger-req": "onFingerRequest",
        "mudlist": "onReceiveMudlist",
        "startup-reply": "onStartupReply",
        "tell": "onTellMessage",
        "who-req": "onWhoRequest"
    };

class I3MUDEntry {
    /**
     * Construct a new MUD entry.
     * @param {string} name The name of the remote MUD.
     * @param {any[]} data The data packet received from the network.
     * @param {string} routerId The router ID this MUD is associated with
     */
    constructor(name, data, routerId) {
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

        this.routerId = routerId;

        /** @type {Object.<string,boolean>} */
        this.services = data[11];

        /** @type {Object.<string,any>} */
        this.xtraInfo = data[12];
    }
}

class I3RouterEntry {
    /**
     * Constructs a new router entry.
     * @param {any[]} packet A packet of data describing an I3 router.
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

    get address() {
        let val = get(undefined);
        if (!val) {
            val = get(efuns.mudInfo().serverAddress);
        }
        return val;
    }

    protected set address(addr) {
        if (typeof addr === 'string')
            set(addr);
    }

    get channelListId() {
        return get(0);
    }

    protected set channelListId(id) {
        if (typeof id === 'number' && id > this.channelListId) set(id);
    }

    get id() {
        return get('klf');
    }

    protected set id(val) {
        if (typeof val === 'string' && val.length > 0)
            set(val);
    }

    get mudListId() {
        return get(0);
    }

    protected set mudListId(id) {
        if (typeof id === 'number' && id > this.mudListId) set(id);
    }

    protected get password() {
        return get(0);
    }

    protected set password(pwd) {
        if (typeof pwd === 'number')
            set(pwd);
    }

    get port() {
        return get(8787);
    }

    protected set port(n) {
        if (typeof n === 'number' && n > 0 && n < (2 ** 16))
            set(n);
    }

    get $socket() {
        return get();
    }

    protected set $socket($socket) {
        if (typeof $socket === 'object')
            set($socket);
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

    /**
     * Object used to parse MUD socket traffic
     */
    get $parser() {
        return get(new lpc.LPCParser());
    }

    /**
     * Send a message to the router if connected.
     * @param {any[]} packet The data to transmit.
     */
    sendMessage(packet) {
        if (this.$socket && this.$socket.readyState === 'open') {
            this.$socket.write(this.$parser.wireFormat(packet));
        }
    }
}

class I3Daemon extends MUDObject {
    async createAsync() {
        master().on('ready', async () => {
            if (efuns.featureEnabled('intermud3')) {
                console.log('Restoring I3Daemon...');
                if (!await efuns.restoreObjectAsync('save/I3Daemon')) {
                    let mudInfo = efuns.mudInfo();
                    await this.addRouter({
                        id: '*kmud',
                        address: mudInfo.serverAddress,
                        port: 8787
                    });
                }
            }
            await this.initialize();
        });
    }

    private connectRouter(id, router) {
        let socket = new net.Socket(),
            buffer = Buffer.alloc(0);

        socket.on('connect', () => {
            logger.log('I3 Daemon is connected');
            this.startup(router);
        });
        socket.on('end', () => {
            logger.log(`I3 Daemon Connection to ${router.address}:${router.port} was closed; Reconnecting in 60 seconds.`);
            setTimeout(() => {
                buffer = Buffer.alloc(0); // empty any existing buffer
                this.connectRouter(id, router);
            }, 60000);
            try {
                socket.destroy();
            }
            catch (x) { /* do nothing */ }
        });
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
                let line = buffer.slice(ptr + 4, ptr + dataLen + 4).toString('ascii');
                logger.log('I3 Daemon Received: %s', line);

                if (line.length === dataLen) {
                    let packet = this.$parser.deserialize(line);

                    buffer = buffer.slice(4 + dataLen);

                    if (Array.isArray(packet) && packet.length > 3) {
                        var packetType = packet[0], fn = ServiceMap[packetType];
                        if (fn && typeof this[fn] === 'function') {
                            this[fn](this, router, packet);
                        }
                        else {
                            logger.log("Unhandled I3 packet: " + JSON.stringify(packet));
                        }
                    }
                }
            }
            catch (x) {
                logger.log(x);
                // TODO: send error packet.
            }
        });
        socket.on('error', data => {
            logger.log(`I3 Daemon Connection Error on ${router.address}:${router.port}: ${data}; Reconnecting in 30 seconds.`);
            setTimeout(() => {
                this.connectRouter(id, router);
            }, 10000)
            try { socket.destroy(); }
            catch (x) { /* do nothing */ }
        });
        socket.on('timeout', (data) => {
            logger.log(`I3 Daemon Connection Timed Out on ${router.address}:${router.port}: ${data}; Reconnecting in 30 seconds.`);
            setTimeout(() => {
                this.connectRouter(this, id, router);
            }, 30000)
            try { socket.destroy(); }
            catch (x) { /* do nothing */ }
        });
        let opts = {
            port: router.port,
            host: router.address
        };
        socket.connect(opts);
        router.$socket = socket;
    }

    /**
     * Add a MUD to the list of known MUDs.
     * @param {I3MUDEntry} mud Information about the MUD.
     */
    addMud(mud) {
        let mudList = this.mudList;
        mudList[mud.name] = mud;
    }

    /**
     * Adds a new router.
     * @param {I3RouterEntry} router Information about the router.
     */
    protected async addRouter(router) {
        /**
         * @type {I3RouterEntry[]}
         */
        let routers = this.routers,
            exists = routers[router.id] || false;

        if (!exists) {
            this.routers[router.id] = new I3RouterEntry(router);
            await efuns.saveObjectAsync('save/I3Daemon');
        }
    }

    /**
     * Return a specific MUD from the list of known MUDs.
     * @param {string} name The name of the MUD to retrieve
     * @return {I3MUDEntry} The desired MUD
     */
    getMud(name) {
        let muds = this.mudList;
        return muds[name] || false;
    }

    /**
     * @returns {string[]} A list of known MUDs.
     */
    getMudList() {
        let mudList = this.mudList;
        return Object.keys(mudList)
            .sort()
            .map(name => mudList[name]);
    }

    /**
     * Normalize the MUD name
     * @param {string} name The name of the MUD to retrieve.
     * @returns {string|string[]|false} One MUD if the name matches exactly one MUD; Returns multiple 
     */
    getMudName(name) {
        let mudList = this.mudList, norm = name.toLowerCase();
        let result = Object.keys(mudList)
            .filter(mn => mn.toLowerCase().slice(0, name.length) === norm);
        return result.length > 1 ? result : result[0] || false;
    }

    /**
     * The a list of all known MUD names.
     * @returns {string[]} The names of the known MUDs
     */
    getMudNames() {
        return Object.keys(this.mudList).sort();
    }

    /**
     * @type {I3MUDEntry[]} All of the known MUDs.
     */
    get mudList() {
        return get([]);
    }

    /**
     * Get a router entry.
     * @param {string} id The router to retrieve.
     * @returns {I3RouterEntry} The router or false if not found.
     */
    getRouter(id) {
        return this.routers[id] || false;
    }

    get routers() {
        return get({});
    }

    get $parser() {
        return get(new lpc.LPCParser());
    }

    private async initialize() {
        if (efuns.featureEnabled('intermud3')) {
            let routerCount = 0;
            let routers = this.routers;
            Object.keys(routers).forEach(id => {
                this.connectRouter(id, routers[id]);
                routerCount++;
            });
            if (routerCount === 0) {
                await this.addRouter({ id: 'klf', address: '127.0.0.1' });
            }
        }
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onEmoteTo(router, packet) {
        var player = efuns.living.findPlayer(packet[5]);
        if (player) {
            player().writeLine(`%^CYAN%^${packet[3]}@${packet[2]} ${packet[7]}%^RESET%^`);
        }
    }

    /**
     * Oops we caused an error
     * @param {I3RouterEntry} router
     * @param {packet} packet
     */
    onError(router, packet) {
        let player = efuns.living.findPlayer(packet[5]);
        if (player) {
            efuns.message("error", packet[2] + ' reports an error: ' + packet[7], player());
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
        var player = efuns.living.findPlayer(packet[6]);
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
        logger.log('I3 Daemon received mudlist');
        var list = packet[7];
        Object.keys(list).forEach(mud => {
            var data = new I3MUDEntry(mud, list[mud], router.id);
            this.mudList[mud] = data;
        });
        efuns.saveObject('save/I3Daemon');
    }

    /**
     *
     * @param {I3RouterEntry} router
     * @param {any[]} packet
     */
    onStartupReply(router, packet) {
        logger.log("I3 Daemon is on-line");

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
        var player = efuns.living.findPlayer(packet[5]);
        if (player) {
            player().writeLine(`%^RED%^${packet[3]}@${packet[2]} tells you%^RESET%^: ${packet[7]}`);
            player().setProperty('$replyTo', `${packet[3]}@${packet[2]}`);
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

    /** @type {Object.<string, I3RouterEntry> | { length: number }} */
    get routerList() {
        let result = Object.assign({}, get({ length: 0 }));
        return result;
    }

    protected set routerList(routerList) {
        if (typeof routerList === 'object')
            set(routerList);
    }

    serviceSendError(targetUser, targetMud, errorCode, errorMessage, packet) {
        let mud = this.getMud(targetMud),
            router = this.getRouter(mud.routerId);
        if (router) {
            router.sendMessage([
                'error',
                5,
                efuns.mudName(),
                0,
                mud.name,
                targetUser,
                errorCode || '',
                errorMessage || ''
            ]);
        }
    }

    /**
     * Send a tell message.
     * @param {any} tellSender
     * @param {string} tellTarget
     * @param {string} tellMessage
     */
    serviceSendTell(tellSender, tellTarget, tellMessage) {
        let prev = efuns.previousObject();

        let [targetUser, targetMUD] = tellTarget.split('@', 2);
        let mud = this.getMud(targetMUD),
            router = this.getRouter(mud.routerId),
            thisMud = efuns.mudName();
        return router.sendMessage([
            'tell',
            5,
            thisMud,
            tellSender,
            targetMUD,
            targetUser,
            tellSender,
            tellMessage
        ]);
    }

    /**
     * 
     * @param {any[]} socket The connected socket...
     * @param {I3RouterEntry} router The router to connect to
     */
    startup(router) {
        let info = efuns.mudInfo();

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

    /**
     * Set the complete list of routers
     * @param {any} data
     */
    protected setRouterList(data) {
        var routers = this.routerList;

        Object.keys(data).forEach(function (id) {
            if (id.startsWith('*')) {
                routers[id] = new I3Router(data[id]);
                routers.length++;
            }
        });
        this.routerList = routers;
    }
}

module.exports = {
    I3Daemon: await createAsync(I3Daemon),
    I3RouterEntry,
    I3MUDEntry
};

