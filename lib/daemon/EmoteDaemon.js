class EmoteDaemon extends MUDObject {
    /**
     * Add an adverb
     * @param {...string[]} adverbs
     */
    addAdverbs(...adverbs) {
        let added = 0;
        adverbs.forEach((adverb) => {
            let index = this.adverbs.indexOf(adverb)
            if (index === -1) {
                this.adverbs.push(adverb);
                added++;
            }
        });
        if (added > 0)  this.save();
        return this;
    }

    /**
     * Add an emote rule
     * @param {string} verb
     * @param {...string[]} rules
     */
    addEmoteRule(verb, ...rules) {
        let updates = 0, newEntry = false,
            entry = this.emotes[verb] || (newEntry = true, []);

        rules.forEach((rule) => {
            if (entry.indexOf(rule) === -1) {
                updates++;
                entry.push(rule);
                efuns.verbAddRule(verb, rule);
            }
        });

        if (newEntry) this.emotes[verb] = entry;
        if (updates > 0) this.save();
        return this;
    }

    /**
     * @returns {string[]}
     */
    get adverbs() {
        return this.getProperty('adverbs', []);
    }

    set adverbs(list) {
        if (Array.isArray(list))
            return this.setProperty('adverbs', list);
    }

    /**
     * Load emotes from the save file.
     * Examples:
     *    laugh [ "", "at LIV", "WRD at LIV", "at OBJ", "WRD at OBJ", "OBJ in OBJ", "WRD OBJ in OBJ" ]
     */
    create() {
        /** @type {string[]} */
        this.adverbs = [];

        /** @type {Object.<string,string[]>} */
        this.emotes = {};
        efuns.restoreObject(__dirname + '/save/EmoteDaemon.json');
        Object.keys(this.emotes).forEach((verbName) => {
            let rules = this.emotes[verbName];
            if (Array.isArray(rules)) {
                rules.forEach((rule) => efuns.verbAddRule(verbName, rule, this));
            }
        });
    }

    canVerbRule(verb, rule, args) {
        return true;
    }

    /**
     * 
     * @param {string} verb
     * @param {string} rule
     * @param {any[]} args
     * @param {string[]} parse
     */
    doVerbRule(verb, rule, args, parse) {
        let errors = [];
        let youMessage = `You ${verb} ` + parse.map((token) => {
            if (token.startsWith('$')) {
                let parts = token.slice(1).split(':'),
                    tokenIndex = parseInt(parts[0]),
                    tokenType = parts[1],
                    tokenMatch = args[tokenIndex];

                switch (tokenType) {
                    case 'WRD': case 'WORD':
                        let match = this.getAdverb(tokenMatch);
                        if (typeof match === 'string') return match;
                        else if (match.length === 0)
                            errors.push(`No such adverb '${tokenMatch}'`);
                        else {
                            match = match.map((a, i) => {
                                return i + 1 === match.length ?
                                    ` or '${a}'` : i > 0 ? `, '${a}'` : `'${a}'`;
                            });
                            errors.push(`Ambiguous adverb; Could be: ${match.join('')}`);
                        }
                        break;

                    case 'LIV':
                        return tokenMatch.displayName;

                    case 'LVS':
                        return tokenMatch.map((target, index) =>
                            index === 0 ? target.displayName :
                                index + 1 === tokenMatch.length ? ' and ' + target.displayName :
                                    ', ' + target.displayName).join('');
                }
            }
            return token;
        }).join(' ') + '.'

        if (errors.length > 0)
            return errors[0];

        thisPlayer.writeLine(youMessage);

        return true;
    }

    /**
     * Attempt to perform an emote.
     * @param {string} verb The emote verb.
     * @param {string[]} args Additional parameters for the emote.
     */
    cmd(verb, args) {
        return verb in this.emotes ? efuns.parseVerb(verb, args) : false;
    }

    /**
     * @returns {Object.<string,string[]>}
     */
    get emotes() {
        return this.getProperty('emotes', {});
    }

    set emotes(data) {
        if (typeof data !== 'object') return;
        return this.setProperty('emotes', data);
    }

    getAdverb(adverb) {
        let matches = this.adverbs.filter(a => a.startsWith(adverb));
        return matches.length === 1 ? matches[0] : matches;;
    }

    getAdverbs(filter) {
        return filter ? this.adverbs.filter(a => a.match(filter)) : this.adverbs;
    }

    getEmotes(filter) {
        let result = [];
        Object.keys(this.emotes)
            .filter(verb => filter ? verb.match(filter) : true)
            .forEach((verb) => {
                result.push(verb);
                this.emotes[verb].forEach((rule) => {
                    result.push(`\t${verb} ${rule}`);
                });
            });
        return result;
    }

    save() {
        efuns.saveObject(__dirname + '/save/EmoteDaemon.json')
    }

    validVerbTarget(verb, target) {
        return verb in this.emotes;
    }
}

module.exports = EmoteDaemon;

