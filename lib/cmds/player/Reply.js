/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command),
    TellCommand = await efuns.loadObjectAsync('./Tell$TellCommand');

class Reply extends Command {
    cmd(args, input) {
        let replyTo = thisPlayer().getEnv('REPLYTO');

        if (!replyTo)
            return 'Reply to whom?';

        if (replyTo.indexOf('@'))
            return TellCommand().intermudTell(replyTo, input.original);
        else
            return TellCommand().innermudTell(replyTo, input.original);
    }
}

module.exports = new Reply();
