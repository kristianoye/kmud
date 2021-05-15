/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains verb-parsing logic as an add-on feature
 * package.  Please see the config documentation on how to enable/disable it
 * in the Mudlib.
 */
const
    ConfigUtil = require('../ConfigUtil'),
    FeatureBase = require('./FeatureBase'),
    DriverFeature = require('../config/DriverFeature');

const
    MATCH_ALLOW_MULTIPLE = 1,
    MATCH_IS_LIVING = 2,
    MATCH_IS_PLAYER = 4,
    _prepositions = {
        "about": "around",
        "acrosss": null,
        "against": null,
        "around": null,
        "at": null,
        "between": null,
        "down": null,
        "every": null,
        "exit": null,
        "for": null,
        "from": null,
        "here": null,
        "in": null,
        "into": null,
        "inside": null,
        "of": null,
        "off": null,
        "on": null,
        "into": null,
        "inside": "in",
        "near": null,
        "onto": "on",
        "only": null,
        "over": null,
        "room": null,
        "through": null,
        "to": null,
        "up": null,
        "under": null,
        "upon": "on",
        "with": null,
        "within": "in",
        "without": null
    },
    _howMany = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10
    },
    _ordinals = {
        "any": 1,
        "a": 1,
        "first": 1,
        "second": 2,
        "third": 3,
        "fourth": 4,
        "fifth": 5,
        "sixth": 6,
        "seventh": 7,
        "eighth": 8,
        "ninth": 9,
        "tenth": 10
    };

class VerbTokenMatch {
    /**
     * Create a token match container
     * @param {number} index
     */
    constructor(index) {
        this.all = false;
        this.matches = [];
        this.howMany = 1;
        this.index = index;
        this.which = 0;
        this.multi = false;
        this.player = false;
        this.living = false;
        this.identifiers = [];
    }
}

class VerbRule {
    /**
     * Construct a brand new verb.
     * @param {string} verb The verb that initiates the action.
     * @param {string} rule The rule associated with the verb.
     * @param {MUDObject} handler The verb instance that will contain the rule.
     * @param {VerbContainer} container The container creating the rule.
     * @param {string} scope The scope of the rule (if any)
     */
    constructor(verb, rule, handler, container, scope) {
        let tokenInfo =  container.getTokenInfo(rule);

        /** @type {string} */
        this.verb = verb;

        /** @type {string} */
        this.rule = rule;

        /** @type {string} */
        this.scope = scope;

        /** @type {MUDObject} */
        this.handler = handler;

        /** @type {string} */
        this.canMethod = VerbSystemFeature.normalizeRule('can', verb, rule);

        /** @type {string} */
        this.directFallback = VerbSystemFeature.normalizeRule('direct', 'verb', 'rule', false);

        /** @type {string} */
        this.directMethod = VerbSystemFeature.normalizeRule('direct', verb, rule, true);

        /** @type {string} */
        this.doMethod = VerbSystemFeature.normalizeRule('do', verb, rule);

        /** @type {string} */
        this.errorMethod = VerbSystemFeature.normalizeRule('error', verb, rule);

        /** @type {string} */
        this.indirectMethod = VerbSystemFeature.normalizeRule('indirect', verb, rule, true);

        /** @type {number} */
        this.tokenCount = tokenInfo.Count;

        /** @type {number} */
        this.ruleWeight = tokenInfo.Weight;

        /** @type {string[]} */
        this.parts = rule.split(/\s+/);

        let tokenIndex = 0;
        this.parse = this.parts.map((part, index) =>
            container.isToken(part) ? `$${tokenIndex++}:${part}` : part);

        this.validate(container);
    }

    /**
     * Check to see if the user can perform the action.
     * @param {any[]} matchData Matched tokens
     * @returns {boolean|string} True if the action can move forward.
     */
    async can(matchData) {
        let handler = unwrap(this.handler),
            method = handler[this.canMethod] || handler[this.fallbackCan];

        if (!method)
            return false;

        return await method.call(handler, this.verb, this.rule, matchData, this.parse);
    }

    /**
     * Try and do the thing...
     * @param {Array<string|MUDObject>} matchData Tokens matched during parsing.
     * @returns {boolean|string} True if the action was successful.
     */
    async do(matchData) {
        let handler = unwrap(this.handler),
            method = handler[this.doMethod] || handler[this.fallbackDo];

        if (!method)
            return false;

        return await method.call(handler, this.verb, this.rule, matchData, this.parse);
    }

    /**
     * Determine if this rule is within the specified scope.
     * @param {string[]} scopes A list of user scopes.
     * @returns {boolean} True if the rule is within scope.
     */
    inScope(scopes) {
        return !scopes || !this.scope || scopes.indexOf(this.scope) > 0;
    }

    /**
     * Validate the rule.
     */
    validate() {
        unwrap(this.handler, handler => {
            if (typeof handler[this.canMethod] !== 'function') {
                let fallbackCan = VerbSystemFeature.normalizeRule('can', 'verb', 'rule', false);
                if (typeof handler[fallbackCan] !== 'function')
                    throw new Error(`Handler ${handler.filename} does not contain ${this.canMethod} or ${fallbackCan}`);
                this.fallbackCan = fallbackCan;
            }
            if (typeof handler[this.doMethod] !== 'function') {
                let fallbackDo = VerbSystemFeature.normalizeRule('do', 'verb', 'rule', false);
                if (typeof handler[fallbackDo] !== 'function')
                    throw new Error(`Handler ${handler.filename} does not contain ${this.doMethod} or ${fallbackDo}`);
                this.fallbackDo = fallbackDo;
            }
        });
    }
}

class Verb {
    constructor(verb) {
        /** @type {string} */
        this.verb = verb;

        /** @type {VerbRule[]} */
        this.rules = [];
    }

    /**
     * Try and parse the user's input.
     * @param {MUDObject} tp The player executing the verb.
     * @param {string} verb The verb being executed.
     * @param {string[]} args The words entered by the user.
     * @returns {string|boolean} Returns true if the verb succeeded.
     */
    tryVerb(tp, verb, args) {
        let rules = this.rules,
            words = args.map(w => _prepositions[w] || w),
            errors = [];

        for (let i = 0, max = rules.length; i < max; i++) {
            let rule = this.rules[i],
                result = rule.tryParse(words);

            if (result === false)
                continue;

            let canCan = rule.can(result);

            if (canCan === true) {
                return rule.do(result);
            }
            else if (typeof canCan === 'string')
                errors.unshift(canCan);
        }
        if (errors.length > 0) {
            return errors[0];
        }
        return false;
    }

    /**
     * Add a rule to the verb.
     * @param {string} ruleText The rule to match against user input.
     * @param {MUDObject} handler The object that handles the verb.
     * @param {VerbContainer} container The container creating the rule.
     * @param {string=} scope The scope of the rule.
     * @returns {boolean} True if successful.
     */
    addRule(ruleText, handler, container, scope) {
        let rule = new VerbRule(this.verb, ruleText, handler, container, scope), x = -1;

        // Look for existing rule with same pattern.
        this.rules.filter((r, i) => { if (r.rule === ruleText) x = i; });

        if (x > 0) this.rules.splice(x, 1);

        this.rules.push(rule);
        if (this.rules.length > 1)
            this.rules.sort((a, b) => a.ruleWeight < b.ruleWeight ? 1 : -1);

        return true;
    }

    /**
     * Return a list of rules that apply to the current user.
     * @param {string[]} scopes The scopes to filter on.
     * @returns {VerbRule[]} All rules that fall within the scope.
     */
    getRulesInScope(scopes) {
        return Array.isArray(scopes) ?
            this.rules.filter(rule => rule.inScope(scopes)) :
            this.rules;
    }
}

class VerbContainer {
    constructor() {
        this.verbs = {};
        this.synonyms = {};
    }

    /**
     * Add a rule to the system.
     * @param {string} verbName The verb name.
     * @param {string} rule The associated rule.
     * @param {object} handler The handler / verb object.
     * @param {string} scope The scope of the rule.
     * @returns {boolean} Returns true on success.
     */
    addRule(verbName, rule, handler, scope) {
        if (!handler) //  Could not determine handler! Ack!
            throw new Error(`No valid handler associated with verb '${verbName}'`);
        let verb = this.getVerb(verbName, true);
        return verb.addRule(rule, handler, this);
    }

    /**
     * Add a synonym for a verb.
     * @param {any} synonym The synonym.
     * @param {any} verbName The verb it executes.
     * @returns {boolean} True on success.
     */
    addSynonym(synonym, verbName) {
        let verb = this.getVerb(verbName);

        if (!verb)
            throw Error(`'${verb}' is not a verb!`);
        if (synonym in this.synonyms && this.synonyms[synonym] !== verb)
            throw Error(`${synonym} is already a synonym for ${this.synonyms[synonym]}!`);

        this.synonyms[synonym] = verb;

        return true;
    }

    /**
     * Get the verb object for a particular synonym.
     * @param {string} synonym The verb that was actually used.
     * @returns {Verb|false} The true verb associated with the synonym or false if not found.
     */
    getSynonym(synonym) {
        let verb = this.synonyms[synonym];
        if (verb) {
            return this.verbs[verb] || false;
        }
        return false;
    }

    /**
     * Extract token information from a rule.
     * @param {string} rule The rule to evaluate.
     * @returns {object} Extracted info with weight and token count.
     */
    getTokenInfo(rule) {
        let Weight = 0,
            Count = rule.split(/\s+/).filter((s, i) => {
                switch (s) {
                    case 'EQUIPMENT': case 'EQP':
                        Weight += 64;
                        return true;

                    case 'INVENTORY': case 'INV':
                        Weight += 32;
                        return true;

                    case 'LIVING': case 'LIV':
                        Weight += 128;
                        return true;

                    case 'LIVINGS': case 'LVS':
                        Weight += 256;
                        return true;

                    case 'OBJECT': case 'OBJ':
                        Weight += 8;
                        return true;

                    case 'OBJECTS': case 'OBS':
                        Weight += 16;
                        return true;

                    case 'PLAYER':
                        Weight += 512;
                        return true;

                    case 'PLAYERS':
                        Weight += 1024;
                        return true;

                    case 'STRING': case 'STR':
                        Weight += 4;
                        return true;

                    case 'WORD': case 'WRD':
                        Weight += 1;
                        return true;
                }
                return false;
            }).length;
        return { Count, Weight };
    }

    /**
     * Get a verb object or optionally create one if not found.
     * @param {string} verb The verb to search for.
     * @param {boolean} createIfMissing Create an entry if the verb is not found.
     * @returns {Verb} Returns a reference to the verb entry.
     */
    getVerb(verb, createIfMissing) {
        let result = this.verbs[verb] || this.getSynonym(verb);
        if (!result && createIfMissing) {
            this.verbs[verb] = result = new Verb(verb);
        }
        return result;
    }

    /**
     * Determines whether a word is a special token.
     * @param {string} word The string to inspect.
     * @returns {boolean} Returns true if the word is a verb-related token.
     */
    isToken(word) {
        switch (word) {
            case 'LIV':
            case 'LIVING':
            case 'LIVINGS':
            case 'LVS':
            case 'OBJ':
            case 'OBJECT':
            case 'OBJECTS':
            case 'OBS':
            case 'PLAYER':
            case 'PLAYERS':
            case 'STR': 
            case 'STRING':
            case 'WORD':
            case 'WRD':
                return true;

            default:
                return false;
        }
    }

    /**
     * Try to match objects based on user object and context.
     * @param {VerbTokenMatch} token The token that needs object matches.
     * @param {MUDObject[]} environments The environments to search within.
     */
    matchObjectToken(token, environments) {
        for (let i = 0, l = environments.length; i < l; i++) {
            unwrap(environments[i], (env) => {
                if (env.isInventoryVisible()) {
                    env.inventory.forEach((item) => {
                        if (token.matches.indexOf(item) === -1) {
                            if (token.identifiers.length === 0 && token.all) {
                                token.matches.push(item);
                            }
                            else if (item.matchesId(token.identifiers)) {
                                token.matches.push(item);
                            }
                            else if (token.multi && item.matchesPluralId(token.identifiers)) {
                                token.matches.push(item);
                                token.which = -1;
                            }
                        }
                    });
                }
            });
        }
    }

    /**
     * Try evaluating a single verb rule to see if it matches.
     * @param {MUDObject} thisPlayer The MUD user performing the action.
     * @param {VerbRule} rule The verb rule being evaluated.
     * @param {string[]} inputs The users text to match against.
     * @param {string[]} errors A collection of ordered error messages.
     * @returns {string|boolean|any[]} Try match a rule to the user's input.
     */
    async tryParseRule(thisPlayer, rule, inputs, errors) {
        let self = this,
            chunks = [],
            chunk = [],
            direct = null,
            indirect = null,
            matchedTokens = [],
            matched = 0, x = 0,
            objTokenCount = 0;

        // Shortcut...
        if (rule.tokenCount === 0) {
            //  Done...
            if (inputs.length === 0) return [];
            return false;
        }

        // User did not specify enough inputs...
        if (rule.tokenCount > inputs.length)
            return false;

        let preps = rule.parts.filter((word, i) => word in _prepositions);
        let prepC = inputs.filter((word, i) => {
            var r = _prepositions[word],
                rt = typeof r;
            if (rt === 'undefined') return false;
            else if (typeof r === 'string') {
                inputs[i] = r;
                return true;
            }
            return r === null;
        });
        if (preps.length > prepC.length) return false;
        for (let x = 0; x < preps.length; x++) {
            if (preps[x] !== prepC[x]) {
                if (_prepositions[prepC[x]] === preps[x]) {
                    continue;
                }
                return false;
            }
        }
        x = 0;
        inputs.forEach(function (word, i, a) {
            if (word !== preps[x]) {
                chunk.push(word);
            }
            else {
                x++;
                if (chunk.length > 0) {
                    chunks.push(chunk);
                    chunk = chunk.slice(chunk.length);
                }
            }
            if (i + 1 === a.length && chunk.length > 0) {
                chunks.push(chunk);
            }
        });
        for (var i = 0, c = 0, pl = rule.parts.length, lastPrep = ''; i < pl; i++) {
            var word = rule.parts[i];

            if (word in _prepositions) {
                lastPrep = word;
                continue;
            }
            else if (!this.isToken(word) && word === rule.parts[i]) {
                // literal match -- do not include in next chunk.
                chunks[c].shift();
                continue;
            }
            else if (this.isToken(word)) {
                var doneWithChunk = false;

                chunk = chunks[c++];

                if (!chunk || chunk.length === 0)
                    return false;

                doneWithChunk = true;

                switch (word) {
                    case 'WORD': case 'WRD':
                        if (chunk.length < 1) return false;
                        matchedTokens.push(chunk[0]), matched++;
                        chunk = chunk.slice(1);
                        if (chunk.length > 0) {
                            c--; // More to do
                            chunks[c] = chunk;
                        }
                        break;

                    case 'LIV':
                    case "LIVING":
                    case "LIVINGS":
                    case 'LVS':
                    case "OBJECT":
                    case "OBJECTS":
                    case "PLAYER":
                    case "PLAYERS":
                        {
                            let
                                thisToken = objTokenCount++ === 0 ?
                                    direct = new VerbTokenMatch() :
                                    indirect = new VerbTokenMatch(),
                                env = thisPlayer.environment,
                                environments = [
                                    thisPlayer,
                                    env
                                ],
                                inv = env.inventory,
                                target;

                            thisToken.index = objTokenCount;
                            thisToken.living = word.startsWith("LIV");
                            thisToken.multi = word.endsWith('S');
                            thisToken.player = word.startsWith('PLAYER');
                            thisToken.quantity = thisToken.multi ? -1 : 1;

                            for (var j = 0; j < inv.length; j++) {
                                if (environments.indexOf(inv[j]) === -1)
                                    environments.push(inv[j]);
                            }
                            for (inv = thisPlayer.inventory, j = 0; j < inv.length; j++) {
                                if (environments.indexOf(inv[j]) === -1)
                                    environments.push(inv[j]);
                            }

                            chunk.forEach(function (word, i) {
                                if (i === 0 && word === 'all') {
                                    thisToken.quantity = -1;
                                    thisToken.all = true;
                                }
                                else if (i === 0 && word in _ordinals) {
                                    thisToken.which = _ordinals[word] - 1;
                                }
                                else if (i === 0 && word in _howMany) {
                                    thisToken.quantity = _howMany[word];
                                }
                                else if (i === 0 && /^\d+$/.test(word)) {
                                    thisToken.quantity = parseInt(word);
                                }
                                else if (word === "the") {
                                    return;
                                }
                                else if ((i + 1) === chunk.length) {
                                    var asInt = parseInt(word);
                                    if (asInt)
                                        thisToken.which = parseInt(word) - 1;
                                    else
                                        thisToken.identifiers.push(word);
                                }
                                else if (word.endsWith("'s")) {
                                    word = word.slice(0, word.length - 2).toLowerCase();
                                    var who = thisPlayer.environment.inventory.filter((target, i) => {
                                        return target.matchesId(word);
                                    });
                                    if (who.length === 1)
                                        environments = [who[0]];
                                }
                                else if (word === "my") {
                                    environments = [thisPlayer];
                                }
                                else
                                    thisToken.identifiers.push(word);
                            });

                            thisToken.lastPrep = lastPrep;
                            this.matchObjectToken(thisToken, environments);
                            thisToken.index = matchedTokens.length;
                            matchedTokens.push(thisToken),
                                matched++;

                            if (thisToken.matches.length === 0)
                                return false;
                        }
                        break;

                    case 'STRING':
                    case 'STR':
                        {
                            if (chunk.length === 0) return false;
                            var str = chunk.join(' ');
                            matchedTokens.push(str), matched++;
                        }
                        break;
                }
            }
        }

        if (matched !== rule.tokenCount)
            return false;

        let
            directMatches = 0, indirectMatches = 0,
            result = matchedTokens.slice(0);

        switch (objTokenCount) {
            /* that wasy easy... */
            case 0:
                return matchedTokens;

            /* hmm okay easy but... */
            case 1:
                if (direct.matches.length > 0) {
                    result[direct.index] = [];

                    await direct.matches.forEachAsync(async matched => {
                        let theseArgs = matchedTokens.slice(0),
                            directResult = false;

                        theseArgs[direct.index] = matched;

                        if (rule.directMethod in matched) {
                            directResult = await matched[rule.directMethod](matched, ...theseArgs);
                        }
                        else if (rule.directFallback in matched) {
                            directResult = await matched[rule.directFallback].call(matched, rule.verb, rule.rule);
                        }
                        if (directResult === true) {
                            result[direct.index].push(matched);
                            directMatches++;
                        }
                        else if (typeof directResult === 'string')
                            errors.push(directResult);
                    });
                }
                break;

            /* ugh */
            case 2:
                if (indirect.matches.length > 0) {
                    var directMethod = rule.directMethod,
                        indirectMethod = rule.indirectMethod;

                    result[direct.index] = [];
                    result[indirect.index] = [];

                    indirect.matches.forEach(_i => {
                        if (indirectMethod in _i) {
                            var theseArgs = matchedTokens.slice(0);

                            theseArgs[indirect.index] = _i;

                            direct.matches.filter(_d => {
                                if (directMethod in _d) {
                                    theseArgs[direct.index] = _d;
                                    var directResult = _d[directMethod].apply(_d, theseArgs);
                                    if (typeof directResult === 'string')
                                        errors.push(directResult);
                                    else if (directResult === true) {
                                        var indirectResult = _i[indirectMethod].apply(_i, theseArgs);
                                        if (indirectResult === true) {
                                            directMatches++ , indirectMatches++;

                                            result[direct.index].push(_d);
                                            result[indirect.index].push(_i);
                                        }
                                        else if (typeof indirectResult === 'string')
                                            errors.push(indirectResult);
                                    }
                                    else if (directResult === false) {
                                        return;
                                    }
                                    else
                                        throw new Error(`Bad result from ${directMethod}; Expected string or boolean but got ${typeof directResult}`);
                                }
                            });
                        }
                    });
                }
                break;
        }

        if (directMatches === 0)
            return false;

        result[direct.index] = result[direct.index].filter(_d => {
            if (direct.living && !_d.isLiving()) {
                errors.push(`${_d.displayName} is not alive.`);
                return false;
            }
            else if (direct.player && !efuns.playerp(_d)) {
                errors.push(`${_d.displayName} is not a player.`);
                return false;
            }
            return true;
        });
        if (direct.which === -1) {
            if (direct.howMany > directMatches) {
                errors.push(`There are only ${efuns.cardinal(indirectMatches)} ${(efuns.plurlize(direct.identifiers.join(' ')))} here.`);
                return false;
            }
        }
        else if (direct.which >= result[direct.index].length) {
            errors.push(`There is no ${(efuns.ordinal(direct.which + 1))} ${(direct.identifiers.join(' '))}`);
            return false;
        }
        else {
            if (direct.multi)
                result[direct.index] = result[direct.index].slice(direct.which, direct.which + 1);
            else
                result[direct.index] = result[direct.index][direct.which];
        }

        if (objTokenCount > 1) {
            result[indirect.index] = result[indirect.index].filter(_d => {
                if (indirect.living && !_d.isLiving()) {
                    errors.push(`${_d.displayName} is not alive.`);
                    return false;
                }
                else if (indirect.player && !efuns.playerp(_d)) {
                    errors.push(`${_d.displayName} is not a player.`);
                    return false;
                }
                return true;
            });
            if (indirect.multi) {
                if (indirect.howMany > indirectMatches) {
                    errors.push(`There are only ${efuns.ordinal(indirectMatches)} ${efuns.plurlize(indirect.identifiers.join(' '))} here.`);
                    return false;
                }
            }
            else {
                result[indirect.index] = result[indirect.index].shift();
            }
        }
        return result;
    }

    /**
     * Try and parse some user input.
     * @param {string} input The user input.
     * @param {MUDObject} player The player performing the action.
     * @param {string[]} scopes The scopes to evaluate (if enabled).
     * @returns {string|boolean} Returns true on success
     */
    async tryParseSentence(input, player, scopes) {
        let words = input.trim().split(/\s+/),
            verbName = words.shift() || false;

        return this.tryParseVerb(verbName, words, player, scopes);
    }

    /**
     * Try parsing a specific verb.
     * @param {string} verbName The verb invoked by the user.
     * @param {string|string[]} input The user's input.
     * @param {MUDObject} thisPlayer The current player.
     * @param {string[]} scopes A list of scopes the user has access to.
     * @returns {boolean|string} True on success
     */
    async tryParseVerb(verbName, input, thisPlayer, scopes) {
        let verb = this.getVerb(verbName, false),
            errors = [];

        if (verb === false)
            return false;

        let rules = verb.getRulesInScope(scopes),
            words = Array.isArray(input) ? input : input.split(/\s+/g);


        //  User does not have access to any applicable rules.
        if (rules.length === 0)
            return false;

        //  Try rules in ranked order from highest to lowest.
        for (let i = 0; i < rules.length; i++) {
            let matchTokens = await this.tryParseRule(thisPlayer, rules[i], words, errors);

            //  We have matched tokens
            if (Array.isArray(matchTokens)) {
                let result = await rules[i].can(matchTokens);
                if (result === true) {
                    if ((result = await rules[i].do(matchTokens)) === true)
                        return true;
                        
                }
                if (typeof result === 'string')
                    errors.push(result);
            }
        }
        return errors.length > 0 ? errors[0] : false;
    }
}

class VerbSystemFeature extends FeatureBase {
    /**
     * @param {DriverFeature} config Config data
     * @param {Object.<string,boolean>} flags Flags indicating what features are available.
     */
    constructor(config, flags) {
        super(config, flags);

        this.allowHandlerParameter = config.parameters.allowHandlerParameter || false;
        this.allowMatchRemotePlayers = config.parameters.allowMatchRemotePlayers || false;
        this.applyNamingConvention = config.parameters.applyNamingConvention || 'camelCase';

        switch (this.applyNamingConvention.toLowerCase()) {
            case 'camelcase':
            case 'default':
            case 'standard':
                VerbSystemFeature.normalizeRule = VerbSystemFeature.normalizeRuleCamelCase;
                break;

            case 'mudos':
            case 'mudos_pipe':
                VerbSystemFeature.normalizeRule = VerbSystemFeature.normalizeRuleMudOS;
                break;

            default:
                throw new Error(`applyNamingConvention: Unknown naming convention: ${this.applyNamingConvention}; Valid types are camelCase or mudos`);
        }

        this.efunNameParseAddRule = config.parameters.efunNameParseAddRule || false;
        this.efunNameParseAddSynonym = config.parameters.efunNameParseAddSynonym || false;
        this.efunNameParseInit = config.parameters.efunNameParseInit || false;
        this.efunNameParseRefresh = config.parameters.efunNameParseRefresh || false;
        this.efunNameParseSentence = config.parameters.efunNameParseSentence || false;
        this.efunNameParseVerb = config.parameters.efunNameParseVerb || false;

        this.container = new VerbContainer();
        this.useVerbRuleScope = typeof config.parameters.useVerbRuleScope === 'boolean' ?
            config.parameters.useVerbRuleScope : true;

        flags.verbs = true;
        flags.parseVerbEfun = this.efunNameParseVerb !== false;
    }

    assertValid() {
        ConfigUtil.assertType(this.applyNamingConvention, `driver.features.#${this.id}.parameters.applyNamingConvention`, 'string');
        ConfigUtil.assertType(this.allowHandlerParameter, `driver.features.#${this.id}.parameters.allowHandlerParameter`, 'boolean');
        ConfigUtil.assertType(this.allowMatchRemotePlayers, `driver.features.#${this.id}.parameters.allowMatchRemotePlayers`, 'boolean');
    }

    createExternalFunctions(efunPrototype) {
        let feature = this, container = this.container;
        if (this.efunNameParseAddRule) {
            efunPrototype[this.efunNameParseAddRule] = function (verb, rule, target) {
                let handler = feature.allowHandlerParameter ?
                    target || this.thisObject() : this.thisObject();
                let scope = feature.useVerbRuleScope ?
                    unwrap(handler, (o) => o.verbScope || o.directory) : false;
                return container.addRule(verb, rule, handler, scope);
            };
        }
        if (this.efunNameParseAddSynonym) {
            efunPrototype[this.efunNameParseAddSynonym] = function (synonym, verb) {
                return container.addSynonym(synonym, verb);
            };
        }
        if (this.efunNameParseInit) {
            efunPrototype[this.efunNameParseInit] = function () {
                /* dummy efun */
            };
        }
        if (this.efunNameParseRefresh) {
            efunPrototype[this.efunNameParseRefresh] = function () {
                /* dummy efun */
            };
        }
        if (this.efunNameParseSentence) {
            efunPrototype[this.efunNameParseSentence] = async function (/** @type {string} */ rawInput, /** @type {string[]} */ scopeList) {
                let input = rawInput.trim(),
                    scopes = feature.useVerbRuleScope ?
                        Array.isArray(scopeList) && scopeList.length ?
                            scopeList : false : false,
                    thisPlayer = this.thisPlayer();

                return await container.tryParseSentence(input, thisPlayer, scopes);
            };
        }
        if (this.efunNameParseVerb) {
            efunPrototype[this.efunNameParseVerb] = async function (/** @type {string} */ verb, /** @type {string|string[]} */ input, /** @type {string[]} */ scopeList) {
                let scopes = feature.useVerbRuleScope ?
                    Array.isArray(scopeList) && scopeList.length ?
                        scopeList : false : false,
                    thisPlayer = this.thisPlayer();

                return await container.tryParseVerb(verb, input, thisPlayer, scopes);
            };
        }
    }
}

VerbSystemFeature.normalizeRule = function ( /** @type {string} */ prefix, /** @type {string} */ verb, /** @type {string} */ rule, /** @type {boolean} */ flag) {
    throw new Error('No naming convention was set in config!');
};

VerbSystemFeature.normalizeRuleCamelCase = function (prefix, verb, rule, flag) {
    return prefix + verb.charAt(0).toUpperCase() + verb.slice(1) + rule.split(/\s+/).map(function (s, i) {
        switch (s) {
            case 'LIVING': case 'LIV': return 'Living';
            case 'LIVINGS': case 'LVS': return flag ? 'Living' : 'Livings';
            case 'OBJECT': case 'OBJ': return 'Object';
            case 'OBJECTS': case 'OBS': return flag ? 'Object' : 'Objects';
            case 'PLAYER': return 'Player';
            case 'PLAYERS': return flag ? 'Player' : 'Players';
            case 'STRING': case 'STR': return 'String';
            case 'WORD': case 'WRD': return 'Word';
            default: return s ? s[0].toUpperCase() + s.substr(1) : '';
        }
    }).join('');
};

VerbSystemFeature.normalizeRuleMudOS = function (prefix, verb, rule, flag) {
    return prefix + '_' + verb + '_' + rule.split(/\s+/).map(function (s, i) {
        switch (s) {
            case 'LIVING': return 'liv';
            case 'LIVINGS': return flag ? 'liv' : 'lvs';
            case 'OBJECT': case 'OBJ': return 'obj';
            case 'OBJECTS': case 'OBS': return flag ? 'obj' : 'obs';
            case 'PLAYER': return 'player';
            case 'PLAYERS': return flag ? 'player' : 'players';
            case 'STRING': case 'STR': return 'str';
            case 'WORD': case 'WRD': return 'wrd';
            default: return s ? s.toLowerCase() : '';
        }
    }).join('_');
};

module.exports = VerbSystemFeature;