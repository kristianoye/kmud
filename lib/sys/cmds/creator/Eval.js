MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Eval extends Command {
    cmd(args, data) {
        try {
            var result = eval('(function() { ' + data.input + ' })()'),
                cache = [];

            thisPlayer.writeLine(`Result: ${efuns.identify(result)}`);
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
        return true;
    }

    getHelp() {
        return 'This contains helpful information.';
    }
}

MUD.export(Eval);
