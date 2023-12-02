/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;
import TellCommand from './Tell';

export default singleton class Reply extends Command {
    override cmd(args, input) {
        let replyTo = thisPlayer().getEnv('REPLYTO');

        if (!replyTo)
            return 'Reply to whom?';

        if (replyTo.indexOf('@'))
            return TellCommand->intermudTell(replyTo, input.original);
        else
            return TellCommand->innermudTell(replyTo, input.original);
    }
}
