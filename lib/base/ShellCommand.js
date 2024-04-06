/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Base for most command objects
 */

import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default class ShellCommand {
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

    getVersion(verb) {
        return `${verb} (KMUD coreutils) 1.00

This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

Written by ${this.author}
`;
    }
}