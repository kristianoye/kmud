MUD.include('Base');
MUD.imports(LIB_COMMAND);

class Call extends Command {
    cmd(args, cmdline) {
        try {
            var input = cmdline.input,
                endOfTarget = input.indexOf('.'),
                target = endOfTarget > 0 ? input.slice(0, endOfTarget) : false,
                call = endOfTarget > 0 ? input.slice(endOfTarget) : false,
                resolved = this.resolveTarget(target),
                source = '(function() { var o = efuns.loadObject("{0}"); return o(){1}; })()'.fs(resolved, call),
                result = eval(source);

            return efuns.identify(result);
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

MUD.export(Call);
