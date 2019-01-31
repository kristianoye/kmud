/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Verb extends Command {
    /**
     * Parse the user's input.
     * @param {string[]} args The words entered by the user.
     * @param {MUDInputEvent} evt Data structure containing the user input.
     */
    cmd(args, evt) {
        return efuns.parseVerb(evt.verb, evt.args, this.directory);
    }

    get verb() {
        return this.getProperty('verb');
    }

    /**
     * Add one or more rules 
     * @param {...string[]} rules
     */
    addRules(...rules) {
        rules.forEach(rule => {
            efuns.verbAddRule(this.verb, rule, this);
        });
        return this;
    }

    /**
     * Safeguard certain properties
     * @param {string} prop Any property except verb.
     * @param {any} val
     */
    setProperty(prop, val) {
        if (prop === 'verb')
            throw new Error('Verb cannot be set with setProperty; Use setVerb() instead');
        return super.setProperty(prop, val);
    }

    /**
     * Create one or more synonyms
     * @param {...string[]} list
     * @returns {Verb}
     */
    setSynonyms(...list) {
        list.forEach(syn => {
            efuns.verbAddSynonym(syn, this.verb);
        });
        return this;
    }

    /**
     * Define a verb and possible synonyms.
     * @param {string} verb The primary verb to execute this command.
     * @returns {Verb} A reference to this verb.
     */
    setVerb(verb) {
        if (!this.getProperty('verb')) {
            return super.setProperty('verb', verb);
        }
    }

    get rules() {
        return this.getProperty(_rules, []);
    }
}

module.exports = Verb;

