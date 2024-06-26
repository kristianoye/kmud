﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_VERB } from '@Base';
import { HELP_D } from '@Daemon';

import Verb from LIB_VERB;

export default singleton class Help extends Verb {
    private override create() {
        this
            .setVerb("help")
            .addRules(
                "",
                "help",
                "STRING",
                "STRING in STRING");
    }

    canHelp() {
        return true;
    }

    canHelpHelp() {
        return true;
    }

    canHelpString(topic) {
        return true; 
    }

    canHelpStringInString(word) {
        return true;
    }

    doHelp() {
        return this.doHelpString('Index');
    }

    doHelpHelp() {
        writeLine('Prints this helpful message.');
        return true;
    }

    displayCommandHelp(help) {
        let buffer = `Category: ${help.category}`;
        buffer += '\nNAME:\n' + help.command + '\n';
        buffer += '\nDESCRIPTION:\n' + efuns.wrapText(help.description) + '\n';
        writeLine(buffer);
        return true;
    }

    displayCategory(help) {
        let options = [];

        if (help.parent) options.push(help.parent.category);
        Object.keys(help.categories).sort().forEach(c => options.push(help.categories[c].category));
        Object.keys(help.topics).sort().forEach(c => options.push(c));
        writeLine(efuns.columnText(options.map((o, i) => (i + 1).toSting().padLeft(3) + o.toSting())));
        prompt('text', `\n${help.path} ['q' to quit] `, text => {
            let index = parseInt(text);
            if (text === 'quit' || text === 'q') {
                writeLine('\nExiting help');
                return evt.complete(false);
            }
            else if (index-- > 0 && index < options.length) {
                let result = HELP_D->getHelp(options[index], false);
                return !this.displayHelp(result[0]);
            }
            else {
                writeLine('\nInvalid option\n');
                this.displayCategory(help);
                return false;
            }
        });
        return true;
    }

    displayHelp(help) {
        switch (help.type) {
            case 'category':
                return this.displayCategory(help);

            case 'command':
                return this.displayCommandHelp(help);
        }
    }

    doHelpString(topic) {
        let help = HELP_D->getHelp(topic, false);
        if (help.length === 0)
            return `Could not find help for '${topic}'; Try typing 'help index'`;
        else if (help.length === 1)
            return this.displayHelp(help[0]);
        else {
            // Ambiguous
        }
        return true;
    }

    doHelpStringInString(topic, category) {
        let help = HELP_D->getHelp(topic, category);
        if (help.length === 0)
            return `Could not find help for '${topic}'; Try typing 'help index'`;
        else if (help.length === 1)
            return this.displayHelp(help[0]);
        else {
            // Ambiguous
        }
        return true;
    }
} 
