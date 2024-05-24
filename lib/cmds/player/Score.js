/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class Score extends Command {
    override cmd() {
        return 'Command not implemented';
    }

    webcmd() {
        writeLine('You score!');
        return true;
    }

    getHelpX() {
        return {
            type: 'command',
            category: 'Commands > Player Commands > Status Commands',
            description: `
                <p><strong>Syntax:</strong> score</p>
                <p>The <strong>score</strong> command will display your characters attributes and current status.</p>`,
            seeAlso: ['skills', 'body', 'languages']
        };
    }

}
