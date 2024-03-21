/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import Command from LIB_SHELLCMD;

export default final singleton class EchoCommand extends Command {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} cmdline
     */
    override async cmd(txt, cmdline) {
        let args = cmdline.args;

        if (!txt)
            return errorLine('Echo what?');
        return writeLine(`You echo: ${txt}`);
    }
}
