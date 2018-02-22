MUD.imports('/base/Command');

class Edit extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        var fullPath = efuns.resolvePath(args[0], thisPlayer.workingDirectory),
            fileName = fullPath.slice(fullPath.lastIndexOf('/') + 1),
            options = {},
            newFile = !efuns.isFile(fullPath);

        if (args[0] === '-web') {
            args.shift();
            return this.webcmd(args, evt);
        }

        if (efuns.isDirectory(fullPath))
            return 'You cannot edit a directory!';

        if (!efuns.driverFeature('editor')) {
            return 'Sorry, the in-game editor is not enabled!';
        }
        else if (efuns.queryEditorMode() !== -1) {
            return 'You are already in edit mode!';
        }
        options.mode = efuns.isFile(fullPath) ? /* command mode */ 2 : /* insert mode */ 1;
        thisPlayer.writeLine('Starting editor.');
        efuns.editorStart(fullPath, !efuns.wizardp(thisPlayer), options);
        evt.prompt.text = efuns.thisPlayer().getEditorPrompt();
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
