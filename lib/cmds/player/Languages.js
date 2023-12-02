/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default singleton class Languages extends Command {
    override cmd(args, cmdline) {
        var tp = thisPlayer(),
            langs = tp.languages
                .map(name => Object.assign({ name }, tp.getLanguage(name)))
                .sort((a, b) => {
                    if (a.level === b.level) {
                        return (a.name < b.name) ? -1 : 1;
                    }
                    return a.level < b.level ? 1 : -1;
                })
                .map(lang => `You speak ${lang.name} with ${lang.level}% proficiency.`);

        if (langs.length === 0)
            return errorLine("You cannot speak any languages!");
        else
            return writeLine(langs.join('\n'));
    }

    override getHelp() {
        return {
            type: 'command',
            category: 'Commands > Player Commands > Status Commands',
            command: 'languages',
            description: `
                <p><strong>Syntax:</strong> languages</p>
                <p>The <strong>languages</strong> command will display what languages you can read, write, and speak.</p>`,
            seeAlso: ['score', 'skills', 'body']
        };
    }
}
