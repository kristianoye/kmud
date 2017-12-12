MUD.imports('lpc', 'net');

MUD.imports('/daemon/I3Router');

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
        this.name = name;
        this.state = data[0];
        this.ipAddress = data[1];
        this.playerPort = data[2];
        this.imudTcpPort = data[3];
        this.imudUdpPort = data[4];
        this.mudlib = data[5];
        this.baseMudlib = data[6];
        this.driver = data[7];
        this.mudType = data[8];
        this.openStatus = data[9];
        this.adminEmail = data[10];
        this.services = data[11];
        this.xtraInfo = data[12];
    }
}

class I3Daemon extends MUDObject {
    /**
        * Construct the I3 Daemon
        * @param {MUDCreationContext} ctx The creation context.
        */
    constructor(ctx) {
        super(ctx.prop({
            maxRouterCount: 5,
            mudList: {},
            parser: new lpc.LPCParser(),
            routerCount: 0,
            routerList: {}
        }));
        this.restoreObject('save/I3Daemon', err => {
            if (err !== false || this.routerCount === 0) {
                this.addRouter({
                    id: '*kmud',
                    address: efuns.mudInfo().serverAddress,
                    port: 8787
                });
            }
            this['_parser'] = new lpc.LPCParser();
            this.initialize();
        });
    }

    /**
     * 
     * @param {I3MUDEntry} mud
     */
    addMud(mud) {
        var mudList = this.mudList;
        mudList[mud.name] = mud;
    }

    addRouter(data) {
        var router = data
        this.routers[router.id] = router;
        this.saveObject('save/I3Daemon');
    }

    /**
     * Return a specific MUD from the list of known MUDs.
     * @param {any} name The name of the MUD to retrieve
     * @return {I3MUDEntry} The desired MUD
     */
    getMud(name) {
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
        return Object.keys(this.mudList)
            .sort();
    }

    /**
     * @type {I3MUDEntry[]} All of the known MUDs.
     */
    get mudList() {
        return this.getProperty('mudList', []);
    }

    getRouter(id) {
        return this.routers[id] || false;
    }

    get routers() {
        return this.getProperty('routerList', {});
    }

    get routerCount() {
        return Object.keys(this.routers).length;
    }

    get parser() {
        var result = this['_parser'];
        if (!result)
            result = this['_parser'] = new lpc.LPCParser();
        return result;
    }

    initialize() {
        var self = this,
            buffer = new Buffer(0),
            routers = this.routers;

        var serviceMap = {
            "emoteto": "onEmoteTo",
            "locate-req": "onLocateRequest",
            "finger-req": "onFingerRequest",
            "mudlist": "onReceiveMudlist",
            "startup-reply": "onStartupReply",
            "tell": "onTellMessage",
            "who-req": "onWhoRequest"
        };

        function connectRouter(id, router) {
            var socket = new net.Socket();

            socket.on('connect', (buffer) => {
                console.log('I3 Daemon is connected');
                this.startup(socket);
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
                        var parser = new lpc.LPCParser(line);
                        var packet = parser.deserialize(line);

                        buffer = buffer.slice(4 + dataLen);

                        if (packet instanceof Array && packet.length > 3) {
                            var packetType = packet[0], fn = serviceMap[packetType];
                            if (fn && typeof self[fn] === 'function') {
                                self[fn].call(self, packet, socket);
                            }
                            else {
                                console.log("Unhandled I3 packet: " + JSON.stringify(packet));
                            }
                        }
                    }
                }
                catch (x) {

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
            var opts = {
                port: router.port,
                host: router.address
            };
            socket.connect(opts);
        }

        Object.keys(routers).forEach(id => {
            connectRouter.call(this, id, routers[id]);
        });
    }

    onEmoteTo(packet, socket) {
        var player = efuns.findPlayer(packet[5]);
        if (player) {
            player.writeLine('%^CYAN%^{0}@{1} {2}%^RESET%^'.fs(packet[3], packet[2], packet[7]));
        }
    }

    onFingerRequest(packet, socket) {
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

    onLocateRequest(packet, socket) {
        var player = efuns.findPlayer(packet[6]);
        if (player) this.sendMessage([
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

    onReceiveMudlist(packet, socket) {
        console.log('I3 Daemon received mudlist');
        var list = packet[7];
        Object.keys(list).forEach(mud => {
            var data = new I3MUDEntry(mud, list[mud]);
            this.mudList[mud] = data;
        });
    }

    onStartupReply(packet, socket) {
        console.log("I3 Daemon is on-line");

        if (packet[6] instanceof Array) {
            packet[6].forEach(function (a, i) {
                var router = new I3Router(a, self);
                router.on('packet')
            });
        }
    }

    onTellMessage(packet, socket) {
        var player = efuns.findPlayer(packet[5]);
        if (player) {
            player.writeLine('%^RED%^{0}@{1} tells you%^RESET%^: {2}'.fs(packet[3], packet[2], packet[7]));
        }
    }

    onWhoRequest(packet) {
        var _players = this.players().map(function (p, i) {
            return [
                p.displayName,
                Math.round(p.idleTime / 1000),
                p.getTitle()
            ];
        });
        /*
        _players.push([
            '+services',
            -1,
            'Finger +services@Emerald MUD for a list of additional services.'
        ]);
        */
        this.sendMessage([
            'who-reply',
            5,
            packet[4],
            0,
            packet[2],
            packet[3],
            _players
        ]);
    }

    sendMessage(socket, packet) {
        var data = this.parser.wireFormat(packet);
        socket.write(data);
    }

    startup(socket) {
        var parser = this.parser,
            info = efuns.mudInfo();

        this.sendMessage(socket, [
            'startup-req-3',
            5,
            efuns.mudName(),
            0,
            '*kmud',
            0,
            0, /* todo passwords */
            0, /* old_mudlist_id */
            0, /* old_chanlist_id */
            8000, /* player port */
            8888, /* imud_tcp_port */
            8889, /* imud_udp_port */
            info.mudlibVersion, // 'Emerald MUD 0.1', /* MudLib */
            info.mudlibBaseVersion, 
            info.gameDriver,
            'RPG', /* mud_type */
            'mudlib development',
            'kristianoye@gmail.com',
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
            //  Other data
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
        this.setProperty('routerList', routers);
    }
}

MUD.export(I3Daemon, I3MUDEntry);
