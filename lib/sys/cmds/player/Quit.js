/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class QuitCommand extends Command {

    cmd() {
        let player = thisPlayer();

        if (player.save()) {
            writeLine('Your character has been saved.');
            return efuns.destruct(player) || 'Something went wrong!';
        }
        return writeLine('Your character was not saved; Quit aborted!');
    }
}

module.exports = await createAsync(QuitCommand);
