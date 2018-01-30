class Command extends MUDObject {
    /**
     * Run the command
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        throw new Error('Command not implemented');
    }

    /**
     * Provides help to the help system.
     * @returns {MUDCommandHelp}
     */
    getHelp() {
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

    /**
     * Generate a usage error.
     * @param {string} str
     */
    useError(str) {
        return efuns.queryVerb() + ': ' + str;
    }
}

Command.onRecompile = function (instance) {
    let resolver = efuns.findObject('/sys/daemon/CommandResolver');
    unwrap(resolver, o => o.updateCommand(instance));
};

module.exports = Command;

