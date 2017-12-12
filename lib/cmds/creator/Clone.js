MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Clone extends Command {
    cmd(args, cmdline) {
        try {
            if (args.length === 0) {
                thisPlayer.writeLine('Clone what?');
                return;
            }
            var filename = efuns.resolvePath(args[0], thisPlayer.workingDirectory),
                clonedObject = efuns.cloneObject(filename);

            if (clonedObject) {
                var clone = unwrap(clonedObject);
                thisPlayer.writeLine('You cloned {0}'.fs(clone.getPrimaryName()));
                if (!clone.moveObject(thisPlayer)) {
                    if (!clone.moveObject(thisPlayer.environment)) {
                        thisPlayer.writeLine('Could not move object.');
                        clone.destroy();
                    }
                }
                return true;
            }
        }
        catch (e) {
            thisPlayer.writeLine('Clone error: ' + e);
            thisPlayer.writeLine(e.trace);
        }
        return 'Clone failure';
    }
}

MUD.export(Clone);
