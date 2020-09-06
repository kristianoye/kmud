/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class UpdateCommand extends Command {
    async cmd(text, input) {
        if (!input.args.length === 0) {
            let env = unwrap(thisPlayer().environment);
            if (!env)
                return error('You do not have an environment!');
            input.args.shift(env.filename);
        }
        for (let i = 0; i.input.args.length; i++) {
            let fn = input.args[i],
                path = efuns.resolvePath(fn, thisPlayer().workingDirectory),
                result = efuns.objects.reloadObjectAsync(path)
            writeLine(`Update ${path}: ${(result ? '[OK]' : '[Failure]')}`);
        }
        input.args.forEach(fn => {
            let path = efuns.resolvePath(fn, thisPlayer().workingDirectory);
        })
        return true;
    }
}

module.exports = await createAsync(UpdateCommand);
