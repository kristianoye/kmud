/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 11, 2024
 */
import { LIB_SHELLCMD } from 'Base';
import { COMMAND_D } from 'Daemon';
import ShellCommand from LIB_SHELLCMD;

export default final singleton class WhichCommand extends ShellCommand {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, cmdline) {
        let args = cmdline.args,
            showAll = false,
            showPartial = false;

        for (const arg of args) {
            if (arg.startsWith('-')) {
                switch (arg) {
                    case '--all':
                        showAll = true;
                        break;
                    case '--partial':
                        showPartial = true;
                        break;
                    default:
                        let flags = arg.slice(1).split('');
                        for (const s of flags) {
                            if (s === 'a')
                                showAll = true;
                            else if (s === 'p')
                                showPartial = true;
                            else {
                                errorLine(`${cmdline.verb}: Unrecognized command switch: ${arg}`);
                                return false;
                            }
                        }
                        break;
                }
            }
            else {
                let cmd = await COMMAND_D->resolveAsync(arg, thisPlayer().searchPath, showPartial);
                if (Array.isArray(cmd)) {
                    if (!showAll) {
                        cmd = cmd[0];
                        writeLine(cmd.fullPath)                    }
                    else
                    {
                        for (const match of cmd) {
                            writeLine(match.fullPath);
                        }
                    }
                }
                else if (cmd) {
                    writeLine(cmd.fullPath);
                }
            }
        }
        return true;
    }
}
