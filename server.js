/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
try {
    const
        MUDConfig = require('./src/MUDConfig'),
        GameServer = require('./src/GameServer'),
        MUDData = require('./src/MUDData'),
        ErrorTypes = require('./src/ErrorTypes');

    try {
        if (!MUDConfig.setupMode) {
            MUDConfig.assertValid();
            var gameMaster = new GameServer(MUDConfig);

            /** @type {GameServer} The game server instance */
            gameMaster
                .setLoginObject('/sys/lib/Login')
                .enableGlobalErrorHandler()
                .run(function () {
                    console.log('Done with startup');
                });
        }
    }
    catch (e) {
        console.error(e.message);
        console.error(e.stack);
        process.exit(-2);
    }
}
catch (boom) {
    console.log(boom.message);
    console.log(boom.stack);
    process.exit(-2);
}
