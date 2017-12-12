MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Alias extends Command {
    cmd(args, cmdline) {
        var tp = thisPlayer,
            aliases = thisPlayer.aliases,
            list = Object.keys(aliases);

        if (args.length === 0) {
            if (list.length === 0) {
                thisPlayer.writeLine('You have not created any aliases');
            }
            else {
                for (var k in aliases) {
                    thisPlayer.writeLine('alias {0}=\'{1}\''.fs(k, aliases[k]));
                }
            }
        }
        else
        {
            var m = /([\w]+)=(.+)/.exec(cmdline.input);
            if (m && m.length > 1) {
                thisPlayer.writeLine('Alias {2}: {0}={1}'.fs(m[1], m[2], typeof aliases[m[1]] !== 'undefined' ? 'altered' : 'created'));
                aliases[m[1]] = m[2];
            }
            else if (args[0].startsWith('-')) {
                switch (args[0].slice(1)) {
                    case 'ra':
                    case 'ar':
                        list.forEach(a => {
                            thisPlayer.writeLine('alias: {0}: removed'.fs(a));
                            delete aliases[a];
                        });
                        break;

                    case 'r':
                        thisPlayer.writeLine('args = {0}'.fs(args.length));
                        if (args.length === 2) {
                            if (typeof aliases[args[1]] !== 'undefined') {
                                delete aliases[args[1]];
                                thisPlayer.writeLine('alias: {0}: removed'.fs(args[1]));
                            }
                            else {
                                thisPlayer.writeLine('alias: {0}: not found'.fs(args[1]));
                            }
                        }
                        else
                            return 'Usage: alias -r <alias>';
                        break;

                    case 'reset':
                        list.forEach(a => {
                            thisPlayer.writeLine('alias: {0}: removed'.fs(a));
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
                            thisPlayer.writeLine('Alias {2}: {0}={1}'.fs(kk, r[kk], 'created'));
                            aliases[kk] = r[kk];
                        }
                        break;
                }
            }
            else {
                var foo = aliases[args[0]];
                if (foo) {
                    thisPlayer.writeLine('alias {0}=\'{1}\''.fs(args[0], foo));
                } else {
                    thisPlayer.writeLine('alias: {0}: not found'.fs(args[0]));
                }
            }
        }
        return true;
    }
}

MUD.export(Alias);
