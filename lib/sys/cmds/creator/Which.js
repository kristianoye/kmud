/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 11, 2024
 */
import { LIB_COMMAND } from 'Base';
import { COMMAND_D } from 'Daemon';
import Command from LIB_COMMAND;

export default final singleton class WhichCommand extends Command {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, cmdline) {
        let args = cmdline.args,
            showAll = false;

        for (const arg of args) {
            if (arg === '-a' || arg === '--all')
                showAll = true;
            else {
                let cmd = await COMMAND_D->resolveAsync(arg, thisPlayer().searchPath);
                if (cmd) {
                    writeLine(cmd.fullPath);
                }
            }
        }
        return true;
    }
}
