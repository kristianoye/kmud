MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class SetEnv extends Command {
    /**
        * 
        * @param {string[]} args
        */
    cmd(args) {
        if (args.length === 0) {
            var env = thisPlayer.getenv(),
                keys = Object.keys(env).sort();
            if (keys.length === 0) {
                thisPlayer.writeLine('You have no environmental variables');
            } else {
                keys.forEach(s => {
                    thisPlayer.writeLine(efuns.sprintf('%-30s%s', s, env[s]));
                });
            }
        }
        else {
            var m = /([^\s\=]+)=*(.+)*/.exec(args.join(' '));
            if (m) {
                var key = m[1], val = m[2];
                thisPlayer.writeLine('key: {0}, val: {1}'.fs(key, val));
                thisPlayer.setEnv(key, val ? val : undefined);
            }
        }
        return true;
    }
}

MUD.export(SetEnv);
