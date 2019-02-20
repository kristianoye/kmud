/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class CallCommand extends Command {
    cmd(args, cmdline) {
        try {
            var input = cmdline.input,
                endOfTarget = input.indexOf('.'),
                target = endOfTarget > 0 ? input.slice(0, endOfTarget) : false,
                call = endOfTarget > 0 ? input.slice(endOfTarget + 1) : false,
                resolved = this.resolveTarget(target),
                source = `(function() { var o = efuns.loadObjectSync("${resolved}"); return unwrap(o, ob => ob.${call}  ); })()`;
            write(source);

            var
                result = eval(source);

            write("result = " + efuns.identify(result));
            return true;
        }
        catch (e) {
            write('Error: ' + e);
            write(e.stack);
        }
        return true;
    }

    resolveTarget(spec) {
        if (spec === 'here')
            return thisPlayer().environment.filename;
        else if (spec === 'me' || spec === 'self')
            return thisPlayer().filename;
        var pl = efuns.findPlayer(spec);
        if (pl) return unwrap(pl).filename;
        var fn = efuns.resolvePath(spec, thisPlayer().workingDirectory);
        write('Trying to call ' + fn);
        return fn;
    }
}

module.exports = new CallCommand();
