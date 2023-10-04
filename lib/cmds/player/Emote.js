/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class Emote extends Command {
    cmd(text) {
        writeLine(`You emote: ${thisPlayer().displayName} ${text}`);
        message('thirdPerson',
            `${player.displayName} ${text}`,
            player.environment.inventory, player);
        return true;
    }
}

module.exports = await createAsync(Emote);
