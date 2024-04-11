/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Base for most command objects
 */

import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default class ShellCommand extends Command {
    override create() {
        super.create();
        this.command
            .setAuthor('Kris Oye')
            .setVersion('1.1 (KMUD shell commands)')
    }

    override getShellSettings(verb, options = {}) {
        return Object.assign(options, {
            allowEscaping: true,
            allowFileIO: true,
            allowLineSpanning: true,
            allowPipelining: true,
            command: this,
            expandBackticks: true,
            expandFileExpressions: true,
            historyLevel: 2
        });
    }
}