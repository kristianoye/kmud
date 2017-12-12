MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Find extends Command {
    /**
        * Execute the find command
        * @param {string[]} args
        */
    cmd(args) {
        var opts = {
            dir: thisPlayer.workingDirectory,
            maxDepth: 100,
            name: false,
            regex: false
        };
        for (var i = 0; i < args.length; i++) {
            if (args[i].startsWith('-')) {
                switch (args[i].toLowerCase()) {
                    case '-d': case '-depth': case '-maxdepth': 
                        if (typeof (opts.maxDepth = args[++i]) === 'undefined')
                            return 'Usage: find -depth [max depth]';
                        opts.maxDepth = parseInt(opts.maxDepth);
                        if (typeof opts.maxDepth !== 'number' || opts.maxDepth < 1)
                            return 'Find: -depth must be a positive integer not: ' + opts.maxDepth;
                        break;
                    case '-name':
                        if (typeof (opts.name = args[++i]) === 'undefined')
                            return 'Usage: find -name [filename]';
                        break;

                    case '-regex':
                        if (typeof (opts.regex = args[++i]) === 'undefined')
                            return 'Usage: find -regex [expression]';
                        break;

                    default:
                        return 'Find: Unrecognized option: ' + args[i];
                }
            }
            else {
                var path = efuns.resolvePath(args[0], thisPlayer.workingDirectory);
                if (!efuns.isDirectory(path)) {
                    opts.name = args[0];
                    opts.dir = '/';
                }
                else opts.dir = path;
            }
        }
        var result = $(DAEMON_FILEINDEX).findFiles(opts);
        if (typeof result === 'string')
            return result;

        thisPlayer.writeLine(result.join('\n'));
        return true;
    }
}

MUD.export(Find);
