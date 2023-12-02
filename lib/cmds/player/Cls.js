/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

 export default singleton class ClearScreenCommand extends Command {
    override cmd(args, cmdline) {
        eventSend({ type: 'clearScreen' });
        return true;
    }
}
