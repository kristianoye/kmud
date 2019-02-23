/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class SetEnv extends Command {
    /**
        * 
        * @param {string[]} args
        */
    cmd(args) {
        if (args.length === 0) {
            var env = thisPlayer().getenv(),
                keys = Object.keys(env).sort();
            if (keys.length === 0) {
                writeLine('You have no environmental variables');
            } else {
                keys.forEach(s => {
                    writeLine(efuns.sprintf('%-30s%s', s, env[s]));
                });
            }
        }
        else {
            var m = /([^\s\=]+)=*(.+)*/.exec(args.join(' '));
            if (m) {
                var key = m[1], val = m[2];
                writeLine(`key: {key}, val: {val}`);
                thisPlayer().setEnv(key, val ? val : undefined);
            }
        }
        return true;
    }
}

module.exports = SetEnv;

