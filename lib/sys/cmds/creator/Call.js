MUD.include('Base');

const
    Command = require(LIB_COMMAND);

class CallCommand extends Command {
    cmd(args, cmdline) {
        try {
            var input = cmdline.input,
                endOfTarget = input.indexOf('.'),
                target = endOfTarget > 0 ? input.slice(0, endOfTarget) : false,
                call = endOfTarget > 0 ? input.slice(endOfTarget + 1) : false,
                resolved = this.resolveTarget(target),
                source = `(function() { var o = efuns.loadObject("${resolved}"); return o.${call}; })()`,
                result = eval(source);

            thisPlayer.writeLine("result = " + efuns.identify(result));
            return true;
        }
        catch (e) {
            thisPlayer.writeLine('Error: ' + e);
            thisPlayer.writeLine(e.stack);
        }
        return true;
    }

    resolveTarget(spec) {
        if (spec === 'here')
            return thisPlayer.environment.filename;
        else if (spec === 'me' || spec === 'self')
            return thisPlayer.filename;
        var pl = efuns.findPlayer(spec);
        if (pl) return unwrap(pl).filename;
        var fn = efuns.resolvePath(spec, thisPlayer.workingDirectory);
        thisPlayer.writeLine('Trying to call ' + fn);
        return fn;
    }
}

module.exports = CallCommand;
