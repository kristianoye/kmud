MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Update extends Command {
    cmd(args, cmdline) {
        if (args.length === 0 || !args[0])
            args[0] = thisPlayer.environment.filename;

        var path = efuns.resolvePath(args[0], thisPlayer.workingDirectory);
        thisPlayer.writeLine(`Update ${path}: ${(efuns.reloadObject(path) ? '[OK]' : '[Failure]')}`);
        return true;
    }
}

MUD.export(Update);
