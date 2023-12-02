/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;
import { INTERMUD_D } from 'Daemon';

export default singleton class TellCommand extends Command {
    /**
     * 
     * @param {any} args
     * @param {{ args: string[], text: string, verb: string }} input
     */
    override cmd(args, input) {
        let tellTarget = false,
            tellMessage = '',
            replyTo = thisPlayer().getEnv('REPLYTO');


        if (args.length === 0)
            return 'Usage: tell <player> <message>';
        if (input.verb === 'reply') {
            if (!replyTo)
                return 'Reply: You have not been talking to anyone';
            args.unshift(replyTo);
        }

        for (let i = 1; i < args.length; i++) {
            tellTarget = efuns.living.findPlayer(args.slice(0, i).join(' '));
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
    }

    confirmSend(target, message) {
        writeLine(`%^RED%^You tell ${target}%^RESET%^: ${message}`);
    }

    /**
     * 
     * @param {MUDObject} tellTarget The player receiving the message.
     * @param {string} tellMessage The message to send.
     */
    innermudTell(tellTarget, tellMessage) {
        this.confirmSend(tellTarget.displayName, tellMessage);
        efuns.message("write", `%^RED%^${thisPlayer().displayName} tells you%^RESET%^: ${tellMessage}`, tellTarget);
        tellTarget.setEnv('REPLYTO', thisPlayer().name);
        return true;
    }

    /**
     * 
     * @param {string} tellTarget Target player and remote MUD name.
     * @param {string} tellMessage The message to send.
     */
    intermudTell(tellTarget, tellMessage) {
        this.confirmSend(tellTarget, tellMessage);
        INTERMUD_D->serviceSendTell(thisPlayer().displayName, tellTarget, tellMessage);
        return true;
    }
}
