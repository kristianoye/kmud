const
    Command = require('../../../base/Command');

class Reboot extends Command {
    cmd(args, cmdline) {
        if (!efuns.archp(thisPlayer)) {
            thisPlayer.writeLine('Access denied.');
            return;
        }
        thisPlayer.writeLine('Rebooting...');
        thisPlayer.tellEnvironment(`${thisPlayer.displayName} reboots ${efuns.mudName()}`);
        efuns.shutdown(0);
    }
}

module.exports = Reboot;
