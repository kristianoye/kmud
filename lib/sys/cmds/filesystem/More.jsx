/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class MoreCommand extends Command {
    cmd(args, cmdline) {
        try {
            let fileName = args.trim();
            if (!fileName) 'Usage: more <filename>';
            var player = thisPlayer,
                fullpath = efuns.resolvePath(fileName, thisPlayer().workingDirectory);

            if (fileName === 'here')
                fullpath = thisPlayer().environment.filename + '.js';

            if (!efuns.isFile(fullpath))
                return fullpath + ' is not a file.';

            let content = efuns.readFileSync(fullpath);
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

module.exports = new MoreCommand();
