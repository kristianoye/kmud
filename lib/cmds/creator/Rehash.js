MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Rehash extends Command {
    cmd(args, cmdline) {
        for (var i = 0; i < args.length; i++) {
            this.rehashDirectory(thisPlayer, args[0]);
        }
    }

    rehashDirectory(player, dir) {
        var cwd = player.workingDirectory,
            checkDir = efuns.resolvePath(dir, cwd),
            CommandDaemon = efuns.loadObject(DAEMON_COMMAND);

        if (efuns.isDirectory(checkDir)) {
            thisPlayer.writeLine('Rehashing {0}'.fs(dir));
            CommandDaemon().hashCommandDirectory(checkDir);
        }
        else {
            thisPlayer.writeLine('Rehash: Directory {0} does not exist.'.fs(checkDir));
        }
    }
}

MUD.export(Rehash);
