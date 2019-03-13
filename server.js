/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
try {
    const
        MUDConfig = require('./src/MUDConfig');

    try {
        let config = new MUDConfig();

        config.entryDirectory = __dirname;
        config.entryScript = process.argv[1];

        config.run();
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
