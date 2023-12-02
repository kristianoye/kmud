/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default singleton class Say extends Command {
    /**
     * 
     * @param {string} text The raw text after the verb
     * @param {any[]} args The arguments split out into values
     */
    override cmd(text, args) {
        let player = thisPlayer();

        let verb = text.endsWith('?') ? 'ask' :
            text.endsWith('!') ? 'exclaim' : 'say';

        if (text.trim().length === 0)
            return errorLine('You wish to say something?');

        message('thirdPerson',
            `${player.displayName} ${efuns.pluralize(verb)}, "%^RED%^${text}%^RESET%^"`,
            player.environment.inventory, player);

        return writeLine(`You ${verb}, "%^RED%^${text}%^RESET%^"`);
    }

    help() {
        return [
            'Usage: say <message>',
            '--------------------',
            'Sends a message to players in the same room as yourself.'
        ].join('\n');
    }
}
