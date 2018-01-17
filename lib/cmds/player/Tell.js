
const
    Command = require('../../base/Command'),
    I3Daemon = efuns.loadObject('/daemon/I3Daemon');

class TellCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} input
     */
    cmd(args, input) {
        let tellTarget = false,
            tellMessage = '';

        if (args.length === 0)
            return 'Usage: tell <player> <message>';

        for (let i = 1; i < args.length; i++) {
            tellTarget = efuns.findPlayer(args.slice(0, i).join(' '));
            if (tellTarget) {
                tellMessage = args.slice(i).join(' ');
                break;
            }
            let n = (tellTarget = args.slice(0, i).join(' ')).indexOf('@');
            if (n > -1) {
                let mud = I3Daemon().getMudName(tellTarget.slice(n + 1));
                if (typeof mud === 'string') {
                    tellTarget = tellTarget.slice(0, n) + '@' + mud;
                    tellMessage = args.slice(i).join(' ');
                    break;
                }
            }
            tellTarget = false;
        }
        if (!tellTarget)
            return 'Tell whom what?';
        if (typeof tellTarget === 'string') {
            return this.intermudTell(tellTarget, tellMessage);
        }
        else {
            return unwrap(tellTarget, player => this.innermudTell(player, tellMessage));
        }
        return true;
    }

    confirmSend(target, message) {
        thisPlayer.writeLine(`%^RED%^You tell ${target}%^RESET%^: ${message}`);
    }

    /**
     * 
     * @param {MUDObject} tellTarget The player receiving the message.
     * @param {string} tellMessage The message to send.
     */
    innermudTell(tellTarget, tellMessage) {
        this.confirmSend(tellTarget.displayName, tellMessage);
        efuns.message("write", `%^RED%^${thisPlayer.displayName} tells you%^RESET%^: ${tellMessage}`, tellTarget);
        tellTarget.setProperty('$replyTo', thisPlayer.name);
        return true;
    }

    /**
     * 
     * @param {string} tellTarget Target player and remote MUD name.
     * @param {string} tellMessage The message to send.
     */
    intermudTell(tellTarget, tellMessage) {
        this.confirmSend(tellTarget, tellMessage);
        I3Daemon().serviceSendTell(thisPlayer.displayName, tellTarget, tellMessage);
        return true;
    }
}

module.exports = TellCommand;
