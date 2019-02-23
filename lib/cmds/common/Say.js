/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Say extends Command {
    /**
     * 
     * @param {string} text The raw text after the verb
     * @param {any[]} args The arguments split out into values
     */
    cmd(text, args) {
        let verb = text.endsWith('?') ? 'ask' :
            text.endsWith('!') ? 'exclaim' : 'say';

        write(`You ${verb}, "%^RED%^${text}%^RESET%^"`);
        efuns.message('thirdPerson',
            `${thisPlayer().displayName} ${efuns.pluralize(verb)}, "%^RED%^${text}%^RESET%^"`,
            thisPlayer().environment.inventory, thisPlayer());
        return true;
    }

    help() {
        return [
            'Usage: say <message>',
            '--------------------',
            'Sends a message to players in the same room as yourself.'
        ].join('\n');
    }
}

module.exports = new Say();
