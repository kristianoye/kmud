
const
    Command = require('../../../base/Command');

class ChmodCommand extends Command {
    /**
     * Modify permissions on a directory or file.
     * @param {string[]} args
     */
    cmd(args) {
        if (args.length === 0)
            return 'Usage: chmod [options] file(s)...';
        let path = efuns.resolvePath(args[0], thisPlayer.workingDirectory);
        throw new Error('Not implemented');
    }
}

module.exports = ChmodCommand;
