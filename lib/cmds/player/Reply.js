
const
    Command = require('../../base/Command'),
    TellCommand = efuns.loadObject('Tell');

class ReplyCommand extends Command {
    /**
     * Reply to a previous tell
     * @param {string} args
     * @param {MUDInputEvent} input
     */
    cmd(args, input) {
        let replyTo = thisPlayer.getProperty('$replyTo');
        if (!replyTo)
            return 'Reply to whom?'
        if (replyTo.indexOf('@'))
            return TellCommand().intermudTell(replyTo, input.original);
        else
            return TellCommand().innermudTell(replyTo, input.original);
    }
}

module.exports = ReplyCommand;