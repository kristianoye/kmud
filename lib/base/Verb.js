/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Command = require('./Command'),
    ValidVerb = /^[a-zA-Z]+$/;

class Verb extends Command {
    /**
     * Parse the user's input.
     * @param {string[]} args The words entered by the user.
     * @param {MUDInputEvent} evt Data structure containing the user input.
     * @returns {string|number} Result of the command.
     */
    cmd(text, evt) {
        return efuns.parseVerb(evt.verb, evt.args, this.directory);
    }

    /** @type {string[]} */
    get rules() {
        return ([]);
    }

    get synonyms() {
        return ([]);
    }

    /** @type {string} */
    get verb() {
        return get('');
    }

    protected set verb(value) {
        if (typeof value === 'string' && ValidVerb.test(value))
            set(value);
    }

    /**
     * Add one or more rules 
     * @param {...string} rules The rules associated with the verb.
     * @returns {Verb} Returns a reference to this verb.
     */
    addRules(...rules) {
        rules.forEach(rule => {
            efuns.verbAddRule(this.verb, rule, this);
            this.rules.push(rule);
        });
        return this;
    }

    /**
     * Create one or more synonyms
     * @param {...string} list A list of synonyms that can be used in place of verb.
     * @returns {Verb} A reference to this verb.
     */
    setSynonyms(...list) {
        list.forEach(synonym => {
            efuns.verbAddSynonym(synonym, this.verb);
            this.synonyms.push(synonym);
        });
        return this;
    }

    /**
     * Define a verb and possible synonyms.
     * @param {string} value The primary verb to execute this command.
     * @returns {Verb} A reference to this verb.
     */
    setVerb(value) {
        this.verb = value;
        return this;
    }
}

module.exports = Verb;

