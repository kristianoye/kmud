const
    { MudFeature, FeatureManager } = require('./FeatureManager');

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
    },
    _verbs = '_verbs',
    _rules = '_rules',
    _synonyms = '_synonyms';

function debug(s) {
    var tp = thisPlayer;
    if (efuns.wizardp(tp) && tp.getenv('VDEBUG') === 'true') {
        tp.writeLine(s);
    }
}

function isToken(s) {
    switch (s) {
        case 'LIVING':
        case 'LIVINGS':
        case 'OBJECT':
        case 'OBJECTS':
        case 'PLAYER':
        case 'PLAYERS':
        case 'STRING':
        case 'WORD':
            return true;

        default:
            return false;
    }
}

function getTokenInfo(rule) {
    var weight = 0,
        count = rule.split(/\s+/).filter(function (s, i) {
            switch (s) {
                case 'LIVING':
                    weight += 32;
                    return true;
                case 'LIVINGS':
                    weight += 64;
                    return true;
                case 'OBJECT':
                    weight += 8;
                    return true;
                case 'OBJECTS':
                    weight += 16;
                    return true;
                case 'PLAYER':
                    weight += 128;
                    return true;
                case 'PLAYERS':
                    weight += 256;
                    return true;
                case 'STRING':
                    weight += 4;
                    return true;
                case 'WORD':
                    weight += 1;
                    return true;
            }
            return false;
        }).length;
    return { Count: count, Weight: weight };
}

function locateObjects(token, environments) {
    var result = [], identifiers = token.identifiers;
    for (var i = 0, l = environments.length; i < l; i++) {
        var env = unwrap(environments[i]);
        debug(`\t\tSearching ${env.filename} for ${identifiers.join(' ')}`)
        if (env && 'inventory' in env && env.isInventoryVisible())
            env.inventory.forEach((item, i) => {
                if (result.indexOf(item) === -1) {
                    if (identifiers.length === 0 && token.all)
                        result.push(item);
                    else if (item.matchesId(identifiers)) {
                        result.push(item);
                    }
                    else if (token.multi && item.matchesPluralId(identifiers)) {
                        result.push(item);
                        token.which = -1;
                    }
                }
            });
    }
    debug('\t\tFound ' + result.length + ' possible matches');
    return result;
}

function normalizeRule(rule, flag) {
    return rule.split(/\s+/).map(function (s, i) {
        switch (s) {
            case 'LIVING': return 'Living';
            case 'LIVINGS': return flag ? 'Living' : 'Livings';
            case 'OBJECT': return 'Object';
            case 'OBJECTS': return flag ? 'Object' : 'Objects';
            case 'PLAYER': return 'Player';
            case 'PLAYERS': return flag ? 'Player' : 'Players';
            case 'STRING': return 'String';
            case 'WORD': return 'Word';
            default: return s ? s[0].toUpperCase() + s.substr(1) : '';
        }
    }).join('');
}

/**
    * @param {string} verb The verb used to invoke the action.
    * @param {string[]} input The user's additional input.
    * @param {string[]} errors A collection of errors.
    */
function tryParse(verb, input, errors) {
    var self = this,
        tp = thisPlayer,
        chunks = [],
        chunk = [],
        direct = { all: false, matches: [], howMany: 1, index: 0, which: 0, multi: false, player: false, living: false, identifiers: [] },
        indirect = { all: false, matches: [], howMany: 1, index: 0, which: 0, multi: false, player: false, living: false, identifiers: [] },
        matchedTokens = [],
        matched = 0,
        objTokenCount = 0;

    debug('Considering "{0}"'.fs(this.rule || '<blank>'));

    // lazy special case
    if (this.tokenCount === 0) {
        if (input.length === 0)
            return [];
        return false;
    }

    var preps = this.parts.filter(function (word, i) {
        return word in _prepositions || false;
    });
    var prepC = input.filter(function (word, i) {
        var r = _prepositions[word],
            rt = typeof r;
        if (rt === 'undefined') return false;
        else if (typeof r === 'string') {
            input[i] = r;
            return true;
        }
        return r === null;
    });
    if (preps.length > prepC.length) {
        debug('\tPreposition count differed; Skipping.');
        return false;
    }
    for (var x = 0; x < preps.length; x++) {
        if (preps[x] !== prepC[x]) {
            if (_prepositions[prepC[x]] === preps[x]) {
                debug('\tPreposition {0} is a valid substitute for {1}'.fs(prepC[x], preps[x]));
                continue;
            }
            debug('\tPreposition #{0} differed ({1} v {2})'.fs(x.toString(), preps[x], prepC[x]));
            return false;
        }
    }
    x = 0;
    input.forEach(function (word, i, a) {
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
        if ((i + 1) === a.length && chunk.length > 0) {
            chunks.push(chunk);
        }
    });
    for (var i = 0, c = 0, pl = this.parts.length, lastPrep = ''; i < pl; i++) {
        var word = this.parts[i];

        if (word in _prepositions) {
            debug('\tSkipping matched preposition');
            lastPrep = word;
            continue;
        }
        else if (isToken(word)) {
            var doneWithChunk = false;
            chunk = chunks[c++];

            if (!chunk || chunk.length === 0)
                return false;

            debug('\tTrying to match {0} to {1}'.fs(word, JSON.stringify(chunk)));
            doneWithChunk = true;

            switch (word) {
                case 'WORD':
                    if (chunk.length < 1) return false;
                    debug('\tMatched WORD with {0}'.fs(chunk[0]));
                    matchedTokens.push(chunk[0]), matched++;
                    chunk = chunk.slice(1);
                    if (chunk.length > 0) {
                        c--; // More to do
                        chunks[c] = chunk;
                    }
                    break;

                case "LIVING":
                case "LIVINGS":
                case "OBJECT":
                case "OBJECTS":
                case "PLAYER":
                case "PLAYERS":
                    {
                        var
                            thisToken = objTokenCount++ === 0 ? direct : indirect,
                            env = tp.environment,
                            environments = [
                                tp,
                                env
                            ],
                            inv = env.inventory,
                            target;


                        thisToken.living = word.startsWith("LIV");
                        thisToken.multi = word.endsWith('S');
                        thisToken.player = word.startsWith('PLAYER');
                        thisToken.quantity = thisToken.multi ? -1 : 1;
                        thisToken.index = objTokenCount - 1;

                        for (var j = 0; j < inv.length; j++) {
                            if (environments.indexOf(inv[j]) === -1)
                                environments.push(inv[j]);
                        }
                        for (inv = tp.inventory, j = 0; j < inv.length; j++) {
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
                                var who = tp.environment.inventory.filter((target, i) => {
                                    return target.matchesId(word);
                                });
                                if (who.length === 1)
                                    environments = [who[0]];
                            }
                            else if (word === "my") {
                                environments = [tp];
                            }
                            else
                                thisToken.identifiers.push(word);
                        });

                        thisToken.lastPrep = lastPrep;
                        thisToken.matches = locateObjects(thisToken, environments);
                        matchedTokens.push(thisToken.identifiers.join(' ')), matched++;

                        if (thisToken.matches.length === 0)
                            return false;
                    }
                    break;

                case "STRING":
                    {
                        if (chunk.length === 0) return false;
                        var str = chunk.join(' ');
                        debug('\t\tMatched ' + str);
                        matchedTokens.push(str), matched++;
                    }
                    break;
            }
        }
    }

    if (matched !== this.tokenCount)
        return false;

    var
        directMatches = 0, indirectMatches = 0,
        result = matchedTokens.slice(0);

    switch (objTokenCount) {
        /* that wasy easy... */
        case 0:
            return matchedTokens;

        /* hmm okay easy but... */
        case 1:
            if (direct.matches.length > 0) {
                var directMethod = this.directMethod;
                result[direct.index] = [];
                direct.matches.forEach(_d => {
                    var theseArgs = matchedTokens.slice(0);
                    theseArgs[direct.index] = _d;
                    debug('\tLooking for {0} in {1}'.fs(directMethod, _d.filename));
                    if (directMethod in _d) {
                        debug('\t\t\tCalling {0} in {1}'.fs(directMethod, _d.filename));
                        var directResult = _d[directMethod].apply(_d, theseArgs);
                        if (directResult === true) {
                            result[direct.index].push(_d);
                            directMatches++;
                        }
                        else if (typeof directResult === 'string')
                            errors.push(directResult);
                    }
                });
            }
            break;

        /* ugh */
        case 2:
            if (indirect.matches.length > 0) {
                var directMethod = this.directMethod,
                    indirectMethod = this.indirectMethod;

                result[direct.index] = [];
                result[indirect.index] = [];

                indirect.matches.forEach(_i => {
                    debug('\tLooking for {0} in {1}'.fs(indirectMethod, _i.filename));
                    if (indirectMethod in _i) {
                        var theseArgs = matchedTokens.slice(0);

                        theseArgs[indirect.index] = _i;

                        direct.matches.filter(_d => {
                            debug('\tLooking for {0} in {1}'.fs(directMethod, _d.filename));
                            if (directMethod in _d) {
                                debug('\t\t\tCalling {0} in {1}'.fs(directMethod, _d.filename));

                                theseArgs[direct.index] = _d;

                                var directResult = _d[directMethod].apply(_d, theseArgs);

                                if (typeof directResult === 'string')
                                    errors.push(directResult);
                                else if (directResult === true) {
                                    debug('\t\t\tCalling {0} in {1}'.fs(indirectMethod, _i.filename));

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
            errors.push('There are only {0} {1} here.'.fs(
                efuns.cardinal(indirectMatches),
                efuns.plurlize(direct.identifiers.join(' '))));
            return false;
        }
    }
    else if (direct.which >= result[direct.index].length) {
        errors.push('There is no {0} {1}'.fs(
            efuns.ordinal(direct.which + 1),
            direct.identifiers.join(' ')));
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
                errors.push('There are only {0} {1} here.'.fs(
                    efuns.ordinal(indirectMatches),
                    efuns.plurlize(indirect.identifiers.join(' '))));
                return false;
            }
        }
        else {
            result[indirect.index] = result[indirect.index].shift();
        }
    }
    return result;
}

class VerbRule {
    /**
        * 
        * @param {String} verb
        * @param {String} rule
        * @param {Verb} instance
        */
    constructor(verb, rule, instance) {
        var tokenInfo = getTokenInfo(rule);
        this.verb = verb;
        this.rule = rule;
        this.instance = instance;
        this.canMethod = 'can' + verb[0].toUpperCase() + verb.substr(1) + normalizeRule(rule);
        this.directMethod = 'direct' + verb[0].toUpperCase() + verb.substr(1) + normalizeRule(rule, true);
        this.doMethod = 'do' + verb[0].toUpperCase() + verb.substr(1) + normalizeRule(rule);
        this.errorMethod = 'error' + verb[0].toUpperCase() + verb.substr(1) + normalizeRule(rule);
        this.indirectMethod = 'indirect' + verb[0].toUpperCase() + verb.substr(1) + normalizeRule(rule, true);
        this.tokenCount = tokenInfo.Count;
        this.ruleWeight = tokenInfo.Weight;
        this.parts = rule.split(/\s+/);
    }

    /**
        * Check to see if the user can perform the action.
        * @param {Object[]} args
        */
    can(args) {
        var v = unwrap(this.instance);

        debug('\tLooking for {0} in {1}'.fs(this.canMethod, v.filename));

        if (typeof v[this.canMethod] === 'function') {

            debug('\t\tCalling ' + this.canMethod);
            var result = v[this.canMethod].apply(v, args);

            if (typeof result === 'string')
                thisPlayer.writeLine(result);
            return result === true;
        }
        return false;
    }

    /**
        * Try and do the thing...
        * @param {ArrayLike<string|MUDObject>} args
        */
    do(args) {
        var v = unwrap(this.instance);

        debug('\tLooking for {0} in {1}'.fs(this.doMethod, v.filename));

        if (typeof v[this.doMethod] === 'function') {
            debug('\t\tCalling ' + this.doMethod);
            var result = v[this.doMethod].apply(v, args);

            if (typeof result === 'string')
                thisPlayer.writeLine(result);
            return result !== false;
        }
        return false;
    }
}

class Verb {
    constructor() {
    }

    /**
     * Parse the user's input.
     * @param {String[]} args The words entered by the user.
     * @param {Object} data Data structure containing the user input.
     */
    cmd(args, data) {
        var verb = data.verb,
            rules = this.rules,
            words = args.map(w => _prepositions[w] || w),
            errors = [],
            tp = thisPlayer;


        for (var i = 0, l = rules.length; i < l; i++) {
            debug('Evaluating ' + rules[i].rule);
            /** @type {VerbRule} */
            var rule = rules[i],
                result = tryParse.call(rules[i], verb, args, errors);

            if (result === false)
                continue;

            var canCan = rule.can(result);

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

    getVerb() {
        return this.verbs[0];
    }

    getSynonyms() {
        return this.verbs.slice(1);
    }

    /**
     * Add one or more rules 
     * @param {...string[]} rules
     */
    addRules(rules) {
        var args = [].slice.apply(arguments)
            .map(r => new VerbRule(this.getVerb(), r, this))
            .sort((a, b) => a.ruleWeight < b.ruleWeight ? 1 : -1),
            ruleList = this.getProperty(_rules, []);
        ruleList.push(...args);
        return this;
    }

    /**
     * Sets a default error that will be displayed if none of the rules
     * come close to matching.
     * @param {any} msg
     */
    setError(msg) {
        return this.setProperty('_error', msg);
    }

    /**
     * Define a verb and possible synonyms.
     */
    setVerb(verb) {
        var self = this,
            args = [].slice.apply(arguments),
            verbs = this.getProperty('_verbs', []);
        verbs.push(...args);
        return this;
    }

    get rules() {
        return this.getProperty(_rules, []);
    }

    get verbs() {
        return this.getProperty(_verbs, []);
    }
}


module.exports = {
    Verb,
    VerbRule,
    register: function () {

    }
};
