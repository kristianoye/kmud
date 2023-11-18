/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class CallCommand extends Command {
    async cmd(args, cmdline) {
        try {
            let input = cmdline.input,
                endOfTarget = input.indexOf('.'),
                target = endOfTarget > 0 ? input.slice(0, endOfTarget) : false,
                methodOrProperty = endOfTarget > 0 ? input.slice(endOfTarget + 1) : false,
                resolved = this.resolveTarget(target),
                source = `await (async () { let o = await efuns.loadObjectAsync("${resolved}"); return unwrap(o, ob => ob.${methodOrProperty}); })()`;
            writeLine(source);

            let
                result = await evalAsync(source);

            writeLine("result = " + efuns.identify(result));
            return true;
        }
        catch (e) {
            writeLine('Error: ' + e);
            writeLine(e.stack);
        }
        return true;
    }

    resolveTarget(spec) {
        if (spec === 'here')
            return thisPlayer().environment.filename;
        else if (spec === 'me' || spec === 'self')
            return thisPlayer().filename;

        let player = efuns.living.findPlayer(spec);
        if (player) return unwrap(player).filename;
        let fn = efuns.resolvePath(spec, thisPlayer().workingDirectory);
        writeLine('Trying to call ' + fn);
        return fn;
    }
}

module.exports = await createAsync(CallCommand);
