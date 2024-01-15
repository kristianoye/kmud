/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
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
        return get([]);
    }

    /**
     * Load emotes from the save file.
     * Examples:
     *    laugh [ "", "at LIV", "WRD at LIV", "at OBJ", "WRD at OBJ", "OBJ in OBJ", "WRD OBJ in OBJ" ]
     */
    private async create() {
        await efuns.restoreObjectAsync('save/EmoteDaemon.json');
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
        var thisPlayer = efuns.thisPlayer();
        let errors = [], 
            firstPerson = ['You', verb],
            secondPerson = [thisPlayer.displayName, efuns.pluralize(verb)],
            thirdPerson = [thisPlayer.displayName, efuns.pluralize(verb)],
            targets = [];

        parse.forEach((token, tokenIndex) => {
            if (token.startsWith('$')) {
                let parts = token.slice(1).split(':'),
                    tokenIndex = parseInt(parts[0]),
                    tokenType = parts[1],
                    tokenMatch = args[tokenIndex];

                switch (tokenType) {
                    case 'WRD': case 'WORD':
                        let match = this.getAdverb(tokenMatch);
                        if (typeof match === 'string') {
                            firstPerson.push(match);
                            secondPerson.push(match);
                            thirdPerson.push(match);
                        }
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

                    case 'OBJ':
                        if (efuns.present(tokenMatch, thisPlayer)) {
                            firstPerson.push('your', tokenMatch.displayName);
                            secondPerson.push(efuns.possessive(thisPlayer), tokenMatch.displayName);
                            thirdPerson.push(efuns.possessive(thisPlayer), tokenMatch.displayName);
                        }

                        break;

                    case 'OBS':
                        break;

                    case 'LIV':
                        targets.pushDistinct(tokenMatch);
                        firstPerson.push(tokenMatch.displayName);
                        secondPerson.push('you');
                        thirdPerson.push(tokenMatch.displayName);
                        break;

                    case 'LVS':
                        tokenMatch.forEach((target, index) => {
                            targets.pushDistinct(target);
                            firstPerson.push(target.displayName);
                            secondPerson.push('you');
                            thirdPerson.push(target.displayName);
                        });
                        break;
                }
            }
            else {
                firstPerson.push(token);
                secondPerson.push(token);
                thirdPerson.push(token);
            }
        });

        if (errors.length > 0)
            return errors[0];

        writeLine(firstPerson.join(' ').trim() + '.');

        if (targets.length > 0)
            efuns.message('secondPerson', secondPerson.join(' ').trim() + '.', targets, [thisPlayer]);

        targets.push(thisPlayer);

        efuns.message("thirdPerson", thirdPerson.join(' ').trim() + '.', thisPlayer.environment.inventory, targets);

        return true;
    }

    /**
     * Attempt to perform an emote.
     * @param {string} verb The emote verb.
     * @param {string[]} args Additional parameters for the emote.
     */
    async cmd(verb, args) {
        if (verb in this.emotes === true)
            return await efuns.parseVerb(verb, args);
        return false;
    }

    /**
     * @returns {Object.<string,string[]>}
     */
    get emotes() {
        return get({});
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
            .sort()
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

module.defaultExport = await createAsync(EmoteDaemon);
var foo = 1 + 1;