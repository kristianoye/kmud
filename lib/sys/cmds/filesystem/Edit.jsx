/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class EditFileCommand extends Command {
    cmd(args, evt) {
        var fullPath = efuns.resolvePath(args[0], thisPlayer().workingDirectory),
            fileName = fullPath.slice(fullPath.lastIndexOf('/') + 1),
            options = {},
            newFile = !efuns.isFile(fullPath);

        if (args[0] === '-web') {
            args.shift();
            return this.webcmd(args, evt);
        }

        if (efuns.isDirectorySync(fullPath))
            return 'You cannot edit a directory!';

        if (!efuns.driverFeature('editor')) {
            return 'Sorry, the in-game editor is not enabled!';
        }
        else if (efuns.queryEditorMode() !== -1) {
            return 'You are already in edit mode!';
        }
        options.mode = efuns.isFile(fullPath) ? /* command mode */ 2 : /* insert mode */ 1;
        writeLine('Starting editor.');
        efuns.editorStart(fullPath, !efuns.wizardp(thisPlayer), options);
        evt.prompt.text = efuns.thisPlayer().getEditorPrompt();
        return true;
    }

    webcmd(args, data) {
        var fullPath = efuns.resolvePath(args[0], thisPlayer().workingDirectory),
            fileName = fullPath.slice(fullPath.lastIndexOf('/') + 1),
            newFile = !efuns.isFile(fullPath);

        if (efuns.isDirectorySync(fullPath))
            return 'You cannot edit a directory!';

        eventSend({
            type: 'kmud.wizShell.editFile',
            data: {
                fullPath,
                fileName,
                newFile,
                source: !newFile ? efuns.readFileSync(fullPath) : ''
            }
        });
        return true;
    }
}

module.exports = new EditFileCommand();
