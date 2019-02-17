/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('Object')

class GameObject extends MUDObject {
    constructor(data) {
        super(data);

        register({
            object: {
                weight: 0,
                name: 'object',
                description: "It isn't much to look at.",
                idList: [],
                adjectives: []
            }
        });
    }

    get adjectives() {
        let result = get(OB_ADJECTIVES, []);
        return result.map(s => {
            if (s === 'function') return s();
            if (typeof s === 'string') return s;
            return false;
        }).filter(s => typeof s === 'string');
    }

    set adjectives(valueList) {
        if (!Array.isArray(valueList)) {
            if (typeof valueList !== 'string')
                throw new Error(`Invalid adjective; Must be string or array of strings, not ${typeof valueList}`);
            valueList = [valueList];
        }
        valueList.forEach((s, i) => {
            if (typeof s !== 'string')
                throw new Error(`Invalid adjective at index ${i}; Must be string not ${typeof s}`);
            if (/\s+/.test(s))
                throw new Error(`Invalid adjective at index ${i}; "${s}" cannot contain whitespace`);
        });
        set(OB_ADJECTIVES, valueList);
    }

    get description() {
        return get(OB_DESCRIPTION);
    }

    set description(value) {
        set(OB_DESCRIPTION, value);
    }

    get idList() {
        return get(OB_IDLIST, []);
    }

    set idList(valueList) {
        if (!Array.isArray(valueList)) {
            if (typeof valueList !== 'string')
                throw new Error(`Invalid adjective; Must be string or array of strings, not ${typeof valueList}`);
            valueList = [valueList];
        }
        valueList.forEach((s, i) => {
            if (typeof s !== 'string')
                throw new Error(`Invalid adjective at index ${i}; Must be string not ${typeof s}`);
            if (/\s+/.test(s))
                throw new Error(`Invalid adjective at index ${i}; "${s}" cannot contain whitespace`);
        });
        this.setProperty(OB_IDLIST, valueList);
    }

    isInventoryAccessible() { return false; }

    isInventoryVisible() { return false; }

    get keyId() {
        return get(OB_KEYID, 'object', PRIVATE);
    }

    protected set keyId(value) {
        if (typeof value === 'string' && value.length > 0) {
            set(OB_KEYID, value, PRIVATE);
        }
    }

    matchesId(wordList) {
        if (typeof wordList === 'string')
            wordList = wordList.split(/\s+/g);

        let idList = this.idList,
            adjectives = this.adjectives;

        for (let i = 0, max = wordList.length; i < max; i++) {
            if (adjectives.indexOf(wordList[i]) > -1) continue;
            else if (idList.indexOf(wordList[i]) === -1) return false;
        }
        return true;
    }

    matchesPluralId(wordList) {
        if (typeof wordList === 'string')
            wordList = wordList.split(/\s+/g);
        let adj = this.adjectives,
            plurals = this.pluralIds;

        for (var i = 0, max = wordList.length; i < max; i++) {
            if (adj.indexOf(wordList[i]) > -1) continue;
            else if (plurals.indexOf(wordList[i]) === -1) return false;
        }
        return true;
    }

    get name() {
        return get(OB_KEYID, 'object', PRIVATE);
    }

    set name(value) {
        return set(OB_KEYID, value, PRIVATE);
    }

    get pluralIds() {
        var result = get(OB_PLURALS, false);
        if (!result)
            return this.idList.map(s => efuns.pluralize(s));
        return Array.isArray(result) ? result.slice(0) : [];
    }

    set pluralIds(valueList) {
        this.setProperty(OB_PLURALS, valueList);
    }

    get pluralizedName() {
        return this.getProperty('pluralizedName', this.primaryName);
    }

    set pluralizedName(name) {
        this.setProperty('pluralizedName', name);
    }

    get primaryName() {
        return this.getProtected('primaryName', 'object')
    }

    protected set primaryName(value) {
        if (typeof value !== 'string' || value.length === 0)
            throw new Error('Invalid primaryName; Must be non-blank string.');

        if (/\s+/.test(value))
            throw new Error('Invalid primaryName; Name should not include spaces.');

        let ids = this.idList;
        value.toLowerCase().replace(/[^a-z]+/g, '');
        if (ids.indexOf(value) < 0)
            ids.unshift(value);
        this.setProtected('primaryName', value);
    }

    get shortDescription() {
        return this.getFirstProperty(true, 'short', 'title') || this.primaryName;
    }

    set shortDescription(value) {
        this.setProperty('short', value);
    }

    get weight() {
        return this.getProperty('weight', 0);
    } 

    set weight(units) {
        this.setProperty('weight', units);
    }

    tellEnvironment(msg, includeSelf) {
        var env = this.environment, self = this;
        msg = msg.replace('$N', this.displayName);
        if (env) {
            env.inventory.forEach((i, n) => {
                if (i === this && includeSelf !== true) return;
                typeof i.writeLine === 'function' && i.writeLine(msg);
            });
        }
    }
}

module.addMixin(GameObject, 'Verbs/ItemSupportBase');

module.exports = GameObject;
