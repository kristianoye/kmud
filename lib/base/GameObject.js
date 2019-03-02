/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('Object')

class GameObject extends MUDObject {
    constructor(data) {
        super(data);
    }

    get adjectives() {
        return get([])
            .map(a => {
                if (s === 'function') return s();
                if (typeof s === 'string') return s;
                return false;
            })
            .filter(s => typeof s === 'string');
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
        set(valueList);
    }

    get longDesc() {
        return get('It is not much to look at.');
    }

    set longDesc(value) {
        if (typeof value === 'string') set(value);
    }

    get idList() {
        return get([]);
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
        set(valueList);
    }

    isInventoryAccessible() {
        return false;
    }

    isInventoryVisible() {
        return false;
    }

    get keyId() {
        return get('');
    }

    protected set keyId(value) {
        if (typeof value === 'string' && value.length > 0) {
            set(value);
        }
    }

    matchesId(wordList) {
        if (typeof wordList === 'string')
            wordList = wordList.split(/\s+/g);

        let idList = this.idList,
            adjectives = this.adjectives;

        for (let i = 0, max = wordList.length; i < max; i++) {
            if (adjectives.indexOf(wordList[i]) > -1) continue;
            else if (wordList[i] === this.keyId) continue;
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
        return this.keyId;
    }

    set name(value) {
        this.keyId = value;
    }

    get pluralIds() {
        let result = get([]);
        if (!Array.isArray(result) || result.length === 0)
            return this.idList.map(s => efuns.pluralize(s));
        return Array.isArray(result) ? result.slice(0) : [];
    }

    set pluralIds(value) {
        if (!Array.isArray(value)) {
            if (typeof value === 'string')
                value = [value];
        }
        if (Array.isArray(value))
            set(value.filter(a => typeof a === 'string'));
    }

    get pluralizedName() {
        return get() || this.keyId;
    }

    set pluralizedName(value) {
        if (typeof value === 'string') set(value);
    }

    protected set primaryName(value) {
        this.keyId = value;
    }

    get shortDesc() {
        return get('An object');
    }

    set shortDesc(value) {
        if (typeof value === 'string' && value.length > 0)  set(value)
    }

    get weight() {
        return get(0);
    } 

    set weight(units) {
        if (typeof units === 'number') set(units);
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
