MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

const
    RM_INTERACTIVE = (1 << 0),
    RM_RECURSIVE = (1 << 1),
    RM_UNLOAD = (1 << 2),
    RM_VERBOSE = (1 << 3),
    RM_FORCE = (1 << 4);

class RmCmd extends Command {
    /**
        * 
        * @param {string[]} args
        */
    cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0], player.workingDirectory),
            p = this.parseOptions(arguments);

        thisPlayer.writeLine(JSON.stringify(p));
    }
}

MUD.export(RmCmd);
