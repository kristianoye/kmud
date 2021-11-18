/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class CloneCommand extends Command {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    async cmd(txt, evt) {
        let result = true;
        try {
            let player = thisPlayer();
            let fullPath = efuns.resolvePath(txt, player.workingDirectory);
            let object = await efuns.objects.cloneObjectAsync(fullPath);

            if (object) {
                if (!await object.moveObjectAsync(player)) {
                    await object.moveObjectAsync(player.environment);
                }
                write(object.filename + ': Cloned');
            }
            else
                result = `Clone: Error: Failed to create an object from ${fullPath}`;
        }
        catch (err) {
            result = `Clone: Error: ${err.message}`;
        }
        return result;
    }
}

module.exports = await createAsync(CloneCommand);
