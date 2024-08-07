/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    path = require('node:path'),
    driverSource = path.join(__dirname, 'src');

//  Nothing but the side-effects, mam
require('./src/Importer')(['.js'], (filename) => !filename.startsWith(driverSource));

var exitCode = 0;

try {
    const
        MUDConfig = require('./src/MUDConfig');

    try {
        let config = new MUDConfig();

        config.entryDirectory = __dirname;
        config.entryScript = process.argv[1];

        setImmediate(async () => await config.run());
    }
    catch (e) {
        console.error(e.message);
        console.error(e.stack);
        exitCode = -2;
    }
}
catch (boom) {
    console.log(boom.message);
    console.log(boom.stack);
    exitCode = -2;
}

if (exitCode !== 0) {
    process.exit(exitCode);
}