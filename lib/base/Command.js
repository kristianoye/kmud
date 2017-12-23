class Command extends MUDObject {
    cmd() {
        thisPlayer.writeLine('Command not implemented');
    }

    help() {
        return 'There is no help available';
    }

    parseOptions(args) {
        var result = { defaults: [] }, cur = undefined;

        for (var i = 0, len = args.length; i < len; i++) {
            var arg = args[i];
            if (arg.startsWith('-') || arg.startsWith('/')) {
                arg = arg.substr(arg.startsWith('--') ? 2 : 1);
                if (!result[cur = arg]) result[arg] = [];
                continue;
            }
            result[cur || 'defaults'].push(arg);
        }
        return result;
    }
}

module.exports = Command;

