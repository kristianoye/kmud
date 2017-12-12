MUD.include('Base');
MUD.imports(LIB_COMMAND);

class Goto extends Command {
    cmd(args) {
        var path = efuns.resolvePath(args[0] || '~', thisPlayer.workingDirectory);
        if (efuns.isFile(path + (path.endsWith('.js') ? '' : '.js'))) {
            if (thisPlayer.environment.filename === path) {
                return 'You twitch';
            }
            thisPlayer.moveObject(path);
            return 1;
        }
        else {
            thisPlayer.writeLine('No such file or directory: ' + path);
        }
        return true;
    }
}

MUD.export(Goto);
