/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class SetEnv extends Command {
    /**
        * 
        * @param {string[]} args
        */
    override async cmd(txt, cmd) {
        let args = cmd.args;

        if (args.length === 0) {
            let env = thisPlayer().exportEnv(),
                keys = Object.keys(env).sort();
            if (keys.length === 0) {
                writeLine('You have no environmental variables');
            } else {
                keys.forEach(s => {
                    let val = typeof env[s] === 'function' ? env[s]() : env[s];
                    if (typeof val === 'object') {
                        val = JSON.stringify(val, undefined, 3)
                            .split('\n')
                            .map((s, i) => i === 0 ? s : ' '.repeat(30) + s)
                            .join('\n');
                    }
                    writeLine(`${s}`.padRight(30) + val);
                });
            }
        }
        else {
            let m = /([^\s\=]+)=*(.+)*/.exec(args.join(' '));
            if (m) {
                let key = m[1],
                    val = m[2],
                    result = thisPlayer().setEnv(key, val ? val : undefined);
                return writeLine(`${key}=${result}`);
            }
        }
        return true;
    }
}


