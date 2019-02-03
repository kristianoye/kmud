/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Languages extends Command {
    cmd(args, cmdline) {
        var tp = thisPlayer,
            langs = tp.languages
                .map(name => efuns.merge({ name: name }, tp.getLanguage(name)))
                .sort((a, b) => {
                    if (a.level === b.level) {
                        return (a.name < b.name) ? -1 : 1;
                    }
                    return a.level < b.level ? 1 : -1;
                })
                .map(lang => `You speak ${lang.name} with ${lang.level}% proficiency.`);

        if (langs.length === 0)
            return "You cannot speak any languages!";
        else
            tp.writeLine(langs.join('\n'));
        return true;
    }

    getHelp() {
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

module.exports = new Languages();

