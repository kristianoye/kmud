MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Rehash extends Command {
    cmd(args, cmdline) {
        if (args.length === 0)
            return 'Usage: rehash [directory]';
        for (var i = 0; i < args.length; i++) {
            this.rehashDirectory(thisPlayer, args[0]);
        }
        return true;
    }

    rehashDirectory(player, dir) {
        var cwd = player.workingDirectory,
            checkDir = efuns.resolvePath(dir, cwd),
            CommandDaemon = efuns.loadObject(DAEMON_COMMAND);

        if (efuns.isDirectory(checkDir)) {
            efuns.write(`Rehashing ${dir}`);
            CommandDaemon().hashCommandDirectory(checkDir);
        }
        else {
            efuns.write(`Rehash: Directory ${checkDir} does not exist.`);
        }
    }
}

MUD.export(Rehash);
