/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class UpdateCommand extends Command {
    cmd(text, input) {
        if (!input.args.length === 0) {
            let env = unwrap(thisPlayer().environment);
            if (!env)
                return error('You do not have an environment!');
            input.args.shift(env.filename);
        }
        input.args.forEach(fn => {
            let path = efuns.resolvePath(fn, thisPlayer().workingDirectory);
            writeLine(`Update ${path}: ${(efuns.reloadObjectSync(path) ? '[OK]' : '[Failure]')}`);
        })
        return true;
    }
}

module.exports = await createAsync(UpdateCommand);
