/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Alias extends Command {
    cmd(args, cmdline) {
        var tp = thisPlayer,
            aliases = thisPlayer().aliases,
            list = Object.keys(aliases);

        if (args.length === 0) {
            if (list.length === 0) {
                writeLine('You have not created any aliases');
            }
            else {
                for (var k in aliases) {
                    writeLine(`alias ${k}='${aliases[k]}'`);
                }
            }
        }
        else
        {
            var m = /([\w]+)=(.+)/.exec(cmdline.input);
            if (m && m.length > 1) {
                writeLine(`Alias ${(typeof aliases[m[1]] !== 'undefined' ? 'altered' : 'created')}: ${m[1]}=${m[2]}`);
                aliases[m[1]] = m[2];
            }
            else if (args[0].startsWith('-')) {
                switch (args[0].slice(1)) {
                    case 'ra':
                    case 'ar':
                        list.forEach(a => {
                            writeLine(`alias: ${a}: removed`);
                            delete aliases[a];
                        });
                        break;

                    case 'r':
                        writeLine(`args = ${args.length}`);
                        if (args.length === 2) {
                            if (typeof aliases[args[1]] !== 'undefined') {
                                delete aliases[args[1]];
                                writeLine(`alias: ${args[1]}: removed`);
                            }
                            else {
                                writeLine(`alias: ${args[1]}: not found`);
                            }
                        }
                        else
                            return 'Usage: alias -r <alias>';
                        break;

                    case 'reset':
                        list.forEach(a => {
                            writeLine(`alias: ${a}: removed`);
                            delete aliases[a];
                        });
                        var r = {
                            down: 'go down',
                            east: 'go east',
                            eq: 'inventory',
                            exa: 'look at $*',
                            inv: 'inventory',
                            i: 'inventory',
                            north: 'go north',
                            northwest: 'go northwest',
                            northeast: 'go northeast',
                            south: 'go south',
                            southeast: 'go southeast',
                            southwest: 'go southwest',
                            up: 'go up',
                            west: 'go west'
                        };
                        for (var kk in r) {
                            writeLine(`Alias created: ${kk}=${r[kk]}`);
                            aliases[kk] = r[kk];
                        }
                        break;
                }
            }
            else {
                var foo = aliases[args[0]];
                if (foo) {
                    writeLine(`alias ${args[0]}='${foo}`);
                } else {
                    writeLine(`alias ${args[0]}: not found`);
                }
            }
        }
        return true;
    }
}

module.exports = Alias;
