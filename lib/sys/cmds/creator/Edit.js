MUD.imports('/base/Command');

class Edit extends Command {
    cmd(args, data) {
        return true;
    }

    webcmd(args, data) {
        var fullPath = efuns.resolvePath(args[0], thisPlayer.workingDirectory),
            fileName = fullPath.slice(fullPath.lastIndexOf('/') + 1),
            newFile = !efuns.isFile(fullPath);

        if (efuns.isDirectory(fullPath))
            return 'You cannot edit a directory!';

        thisPlayer.eventSend({
            eventType: 'kmud.wizShell.editFile',
            eventData: {
                fullPath: fullPath,
                fileName: fileName,
                newFile: newFile,
                source: !newFile ? efuns.readFile(fullPath) : ''
            }
        });
        return true;
    }
}

MUD.export(Edit);
