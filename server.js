/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    GameServer = require('./src/GameServer'),
    GameConfig = require('./src/MUDConfig'),
    MUDData = require('./src/MUDData'),
    ErrorTypes = require('./src/ErrorTypes');

try {
    var
        config = new GameConfig();

    if (!config.setupMode) {
        var gameMaster = new GameServer(config);

        /** @type {GameServer} The game server instance */
        gameMaster
            .setPreloads([
                '/sys/daemon/PlayerDaemon',
                '/base/Interactive',
                '/sys/lib/Login',
                ['/daemon/I3Router', { id: '*kmud', port: 8787, address: MUDData.MasterObject.serverAddress }],
                '/sys/lib/CommandShell',
                '/sys/daemon/FileIndex',
                '/sys/daemon/CommandResolver',
                '/daemon/ChatDaemon',
                '/base/GameObject',
                '/base/Container',
                '/base/Body',
                '/base/Living',
                '/base/Player',
                '/base/Creator',
                '/base/Command',
                '/base/Room',
                '/daemon/I3Daemon',
                '/cmds/player/Who'
            ])
            .setLoginObject('/sys/lib/Login')
            .enableGlobalErrorHandler()
            .run(function () {
                console.log('Done with startup');
            });
    }
}
catch (e) {
    console.error(e.message);
}
