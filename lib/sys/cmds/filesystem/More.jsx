/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from '@Base';
import Command from LIB_SHELLCMD;


export default singleton class MoreCommand extends Command {
    override async cmd(args, cmdline) {
        try {
            let fileName = args.trim();
            if (!fileName) 'Usage: more <filename>';
            var player = thisPlayer,
                fullpath = efuns.resolvePath(fileName, thisPlayer().workingDirectory);

            if (fileName === 'here')
                fullpath = thisPlayer().environment.filename + '.js';

            if (!await efuns.fs.isFileAsync(fullpath))
                return fullpath + ' is not a file.';

            let content = await efuns.fs.readFileAsync(fullpath);
            efuns.text.more(content);
            return true;
        }
        catch (x) {
            writeLine('Error: ' + x);
        }
        return cmdline.complete;
    }

    webcmd(args, cmdline) {
        try {
            if (args.length === 0) {
                writeLine('Usage: more <filename>');
            }
            var player = thisPlayer,
                fullpath = efuns.resolvePath(args[0], player.workingDirectory);

            let content = efuns.readFile(fullpath);
            writeLine('<pre>' + content + '</pre>');
            return true;
        }
        catch (x) {
            writeLine('Error: ' + x);
        }
    }
}
