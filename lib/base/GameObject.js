/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import DropSupport from './mixins/Drop';
import GetSupport from './mixins/Get';
import ListenSupport from './mixins/Listen';
import LookSupport from './mixins/Look';
import PutSupport from './mixins/Put';

/**
 * Represents a physical object in the game.
 */
export default class GameObject extends MUDObject, DropSupport, GetSupport, ListenSupport, LookSupport, PutSupport {
    override create() {
        this->MUDObject::create();
        this->Listen::create();
        this->Look::create();
    }

    //#region Adjectives

    /**
     * @returns {string[]}
     */
    get adjectives() {
        return get([])
            .map(s => {
                if (s === 'function') return s();
                if (typeof s === 'string') return s;
                return false;
            })
            .filter(s => typeof s === 'string');
    }

    set adjectives(valueList) {
        if (!Array.isArray(valueList)) {
            if (typeof valueList !== 'string')
                throw `Invalid adjective; Must be string or array of strings, not ${typeof valueList}`;
            valueList = valueList.split(/\s+/);
        }
        valueList.forEach((s, i) => {
            if (typeof s !== 'string')
                throw `Invalid adjective at index ${i}; Must be string not ${typeof s}`;
            if (/\s+/.test(s))
                throw `Invalid adjective at index ${i}; "${s}" cannot contain whitespace`;
        });
        set(valueList);
    }

    /**
     * Return active adjectives
     * @returns {string[]}
     */
    getAdjectives() {
        return this.adjectives;
    }

    /**
     * Set one or more adjectives that describe this object
     * @param {...string|string[]} list
     */
    setAdjectives(...list) {
        let finalList = [];
        for (const adj of list) {
            if (typeof adj === 'string') {
                finalList.push(adj);
            }
            else if (Array.isArray(adj)) {
                let valid = adj.filter(a => typeof a === 'string');
                if (valid.length) finalList.push(...valid);
            }
        }
        this.adjectives = finalList;
        return this;
    }

    //#endregion

    //#region Identifiers

    id(spec) {
        return this.matchesId(spec);
    }

    /**
     * Get the nouns that describe this object
     * @returns {string[]}
     */
    get idList() {
        return get([]);
    }

    /**
     * Set the nouns that describe this object
     * @param {string|string[]} valueList
     */
    set idList(valueList) {
        if (!Array.isArray(valueList)) {
            if (typeof valueList !== 'string')
                throw `Invalid adjective; Must be string or array of strings, not ${typeof valueList}`;
            valueList = valueList.split(/\s+/);
        }
        for (const [i, s] of Object.entries(valueList)) {
            if (typeof s !== 'string')
                throw `Invalid adjective at index ${i}; Must be string not ${typeof s}`;
            if (/\s+/.test(s))
                throw `Invalid adjective at index ${i}; "${s}" cannot contain whitespace`;
        };
        set(valueList);
    }

    /**
     * Return the primary identifier (e.g. name)
     * @returns {string}
     */
    get keyId() {
        let result = get('');
        if (!result) {
            return this.idList[0];
        }
        return result;
    }

    /**
     * Set the primary identifier (e.g. name)
     * @param {string} id
     */
    set keyId(id) {
        if (typeof id === 'string' && id.length > 0) {
            set(id);
        }
    }

    /**
     * Get pluralized nouns that describe a group of said object
     * Example: A single goose vs geese
     * @returns {string[]}
     */
    get pluralIdList() {
        let result = get([]);
        if (!Array.isArray(result) || result.length === 0)
            return this.idList.map(s => efuns.pluralize(s));
        return Array.isArray(result) ? result.slice(0) : [];
    }

    /**
     * Set the plural identifiers
     * @param {string[]} value
     */
    set pluralIdList(value) {
        if (!Array.isArray(value)) {
            if (typeof value === 'string')
                value = value.split(/\s+/);
        }
        if (Array.isArray(value))
            set(value.filter(a => typeof a === 'string'));
    }

    /**
     * Return the primary identifier (e.g. name)
     * @returns {string}
     */
    getKeyId() {
        return this.keyId;
    }

    /**
     * Set the primary identifier (e.g. name)
     * @param {string} id
     */
    setKeyId(id) {
        this.keyId = id;
        return this;
    }

    /**
     * Get the nouns that describe this object
     * @returns {string[]}
     */
    getId() {
        return this.idList;
    }


    /**
     * See if this object responds to a particular set of words/ID
     * @param {string | string[]} wordList
     * @returns
     */
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

    /**
     * Set one or more nouns that describe this object
     * @param {...string|string[]} list
     */
    setId(...list) {
        for (const id of list) {
            if (typeof id === 'string') {
                finalList.push(id);
            }
            else if (Array.isArray(id)) {
                let valid = id.filter(a => typeof a === 'string');
                if (valid.length) finalList.push(...valid);
            }
        }
        this.idList = finalList;
        return this;
    }

    //#endregion

    //#region Inventory

    /**
     * Base objects are not containers.
     * @param {MUDObject} item The item being added to the container.
     * @returns {boolean} Always false
     */
    canAcceptItem(item) {
        return false;
    }

    /**
     * Base objects are not containers.
     * @returns {boolean} Always false
     */
    isInventoryAccessible() {
        return false;
    }

    /**
     * Base objects are not containers.
     * @returns {boolean} Always false
     */
    isInventoryVisible() {
        return false;
    }

    //#endregion

    //#region Descriptions

    /**
     * @returns {string}
     */
    get longDesc() {
        return get('It is not much to look at.');
    }

    set longDesc(value) {
        if (typeof value === 'string' || typeof value === 'function')
            set(value);
    }

    /**
     * @returns {string}
     */
    getLongDesc() {
        let val = this.longDesc;
        if (typeof val === 'function')
            return val();
        else
            return val;
    }

    /**
     * Set the long description
     * @param {string} str The long description
     * @returns
     */
    setLongDesc(str) {
        this.longDesc = str;
        return this;
    }

    /**
     * @returns {string}
     */
    get shortDesc() {
        return get('');
    }

    /**
     * Sets the short (one line) description of an item
     * @param {string} value The short description
     */
    set shortDesc(value) {
        if (typeof value === 'string' || typeof value === 'function')
            set(value)
    }

    /**
     * @returns {string}
     */
    getShortDesc() {
        let val = this.shortDesc;
        if (typeof val === 'function')
            return val();
        else
            return val;
    }

    /**
     * Set the short description
     * @param {string} str The short description
     * @returns
     */
    setShortDesc(str) {
        this.shortDesc = str;
        return this;
    }

    //#endregion

    //#region Weight/Mass

    /**
     * @returns {number}
     */
    get weight() {
        return get(0);
    }

    /**
     * Set the weight
     * @param {number} units
     */
    set weight(units) {
        if (typeof units === 'number')
            set(units);
    }

    /**
     * Get the mass in grams
     * @returns {number}
     */
    getWeight() {
        return this.weight;
    }

    /**
     * Set the mass
     * @param {number} units The number of unit
     * @param {number} uom The type of unit
     * @returns
     */
    setWeight(units, uom = 1) {
        if (typeof units === 'number' && typeof uom === 'number')
            this.weight = (units * uom);
        return this;
    }

    //#endregion

    //#region Name

    /**
     * Get the capitalized form of the name
     * @returns {string} 
     */
    get capName() {
        let val = get('');
        if (!val) {
            this.name.ucfirst();
        }
        return val;
    }

    /**
     * Set the capitalized form of the name
     * @param {string} name 
     */
    set capName(name) {
        if (typeof name === 'string') {
            let current = efuns.normalizeName(this.getName().toLowerCase()),
                norm = efuns.normalizeName(efuns.stripColor(name));
            if (norm === current)
                set(name);
        }
    }

    /**
     * Get the capitalized form of the name
     * @returns {string} 
     */
    getCapName() {
        return this.capName;
    }

    /**
     * Set the capitalized form of the name
     * @param {string} name 
     * @returns
     */
    setCapName(name) {
        this.capName = name;
        return this;
    }

    /**
     * Get the name.  Note this is a synonym for keyId in the base object.
     * @returns {string} 
     */
    get name() {
        return this.keyId;
    }

    /**
     * Set the name.  Note this is a synonym for keyId in the base object.
     * @param {string} name
     */
    set name(name) {
        this.keyId = name;
    }

    /**
     * Get the name.  Note this is a synonym for keyId in the base object.
     * @returns {string} 
     */
    getName() {
        return this.name;
    }

    /**
     * Set the name.  Note this is a synonym for keyId in the base object.
     * @param {string} name
     * @returns
     */
    setName(name) {
        this.name = name;
        return this;
    }

    //#endregion

    tellEnvironment(msg, includeSelf = false) {
        let env = this.environment;
        msg = msg.replace('$N', this.getCapName());
        if (env) {
            for (const i in env.inventory) {
                if (i === this && includeSelf !== true) return;
                typeof i.writeLine === 'function' && i.writeLine(msg);
            }
        }
    }
}


