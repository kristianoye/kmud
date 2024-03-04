/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2019
 * 
 * Data structure that is array-like but preserves 
 */
const
    crypto = require('crypto');

/** @typedef {{ index: number, value: any, next: LinkedListNode, prev: LinkedListNode }} LinkedListNode */

class LinkedList {
    constructor(initialValue = []) {
        this.length = 0;
        this.nextId = 0;

        /** @type {Object.<number, LinkedListNode>} */
        this.index = {};

        /** @type {LinkedListNode} */
        this.head = false;

        /** @type {LinkedListNode} */
        this.tail = false;

        if (Array.isArray(initialValue) && initialValue.length > 0) {
            initialValue.forEach(v => this.add(v));
        }
    }

    /**
     * Iterate over the collection and execute a method
     * @param {function(any, number):void} code Iterate over the collection
     */
    forEach(code) {
        let node = this.head;
        while (node) {
            code(node.value, node.index);
            node = node.next;
        }
    }

    add(value) {
        let entry = {
            index: this.nextId++,
            value,
            next: false,
            prev: false
        };

        if (!this.head) {
            this.head = this.tail = entry;
        }
        else {
            this.tail.next = entry;
            entry.prev = this.tail;
            this.tail = entry;
        }
        this.index[entry.index] = entry;
        return this.length++, entry.index;
    }

    /**
     * Returns the element at a particular numeric index
     * @param {number} pos The position to try and retrieve from.
     */
    at(pos) {
        let result = this.index[pos];
        return !!result && result.value;
    }

    /** Returns the first element */
    first() {
        return this.head;
    }

    /**
     * Determine if the key is in the collection.
     * @param {any} id
     */
    hasKey(id) {
        return id in this.index;
    }

    /** @type {LinkedListNode} */
    get last() {
        return this.tail;
    }

    get max() {
        return this.tail ? this.tail.index : -1;
    }

    get min() {
        return this.head ? this.head.index : -1;
    }

    /**
     * Get the node after the specified ID/node
     * @param {LinkedListNode|number} id The ID
     * @returns {LinkedListNode} Returns the next node or false if its the end
     */
    next(id) {
        let node = typeof id === 'number' ? this.index[id] : this.index[id.index];
        if (!node)
            throw new Error(`Null exception; Index ${id} does not exist`);
        return node.next ? node.next : false;
    }

    /**
     * Get the node before the specified ID/node
     * @param {LinkedListNode|number} id The ID or node
     * @returns {LinkedListNode} Returns the previous node or false if its the end
     */
    prev(id) {
        let node = typeof id === 'number' ? this.index[id] : this.index[id.index];
        if (!node)
            throw new Error(`Null exception; Index ${id} does not exist`);
        return node.prev ? node.prev : false;
    }

    pop() {
        let node = this.last();
        if (node) {
            this.tail = node.prev;
            delete this.index[node.index];
            this.length--;
            return node;
        }
        return undefined;
    }

    push(item) {
        return this.add(item);
    }

    /**
     * Remove one or more items from the collection.
     * @param {any} index The position at which to start removing.
     * @param {any} count The number of items to remove.
     * @returns {any[]} Returns the items that were removed.
     */
    remove(index, count = 1) {
        let entry = this.index[index],
            prev = entry.prev,
            last = entry.next,
            removed = [];

        while (entry && count--) {
            removed.push(entry.value);
            delete this.index[entry.index];
            last = entry.next;
            entry = entry.next;
        }

        //  The head was removed
        if (!prev) this.head = last;
        //  The tail was removed
        if (!last) this.tail = prev;

        this.length -= removed.length;
        return removed;
    }

    /**
     * Fetch a linked list in reverse order.
     * Note: Order is lost.
     * @returns {LinkedList}
     */
    reverse() {
        return new LinkedList(this.toArray().reverse());
    }

    shift() {
        let node = this.first();
        if (node) {
            this.head = node.next;
            delete this.index[node.index];
            this.length--;
            return node;
        }
    }

    /**
     * Returns a subset of the items
     * @param {number} index The index to start taking elements from
     * @param {any} count THe number of items to retrieve.
     */
    slice(index = -1, count = undefined) {
        let result = [], ptr = this.index[index = index > -1 ? index : this.min];

        if (!ptr)
            return [];

        if (typeof count !== 'number')
            count = this.length - index;

        while (count--) {
            result.push(ptr.value);
            ptr = ptr.next;
        }
        return result;
    }

    /**
     * Convert the items in the collection to an array 
     * @returns {any[]} The items in the list as an array
     */
    toArray() {
        return this.slice();
    }

    unshift(value) {
        let item = {
            next: this.head ? this.head : false,
            prev: false,
            index: this.head ? this.head.index - 1 : 0,
            value
        };
        if (item.index in this.index)
            throw new Error(`Index ${item.index} already exists in collection!  Oops!`);
        this.head = item;
        this.length++;
    }
}

class LinkedListWithID extends LinkedList {
    /**
     * 
     * @param {any} initialValue
     * @param {string|string[]|function(any):string} hashKey
     */
    constructor(initialValue = [], hashKey = undefined) {
        super(Array.isArray(initialValue) ? initialValue : []);

        if (typeof initialValue === 'string')
            hashKey = initialValue;

        if (typeof (this.hashKey = hashKey) === 'string') {
            this.keyLookup = (o) => { return o[this.hashKey]; };
        }
        else if (Array.isArray(hashKey)) {
            hashKey.forEach((e, i) => {
                if (typeof e !== 'string')
                    throw new Error(`All elements of key must be type string; Type at index ${i} was '${typeof e}'`);
            });
            this.keyLookup = (o) => {
                let str = this.hashKey.map(k => o[k]).join('.'),
                    hash = crypto.createHash('md5').update(str).digest('hex');
                return hash;
            }
        }
        else if (typeof this.hashKey === 'function') {
            this.keyLookup = hashKey;
        }
        else
            throw new Error(`Unsupported type of hashKey: ${typeof this.hashKey}`);
        this.hashLookup = {};
    }

    add(value) {
        let hashKey = this.keyLookup(value);

        if (typeof hashKey === 'undefined')
            throw new Error(`Item cannot be added to collection; Could not determine a hash key`);

        if (hashKey in this.hashLookup)
            throw new Error(`Collection already contains a value for key '${hashKey}'`);

        let index = super.add(value);
        this.index[index].hashKey = hashKey;
        this.hashLookup[hashKey] = index;

        return index;
    }

    /**
     * Returns the element at a particular numeric index
     * @param {number|string} pos The position to try and retrieve from.
     */
    at(pos) {
        if (typeof pos === 'string') {
            if (pos in this.hashLookup)
                pos = this.hashLookup[pos];
            else
                return false;
        }
        return super.at(pos);
    }

    /**
     * Look for an element using its hash key
     * @param {string} hashKey The value to look for
     * @param {boolean} allowPartial Allow lookup based on partial id
     */
    find(hashKey, allowPartial = false) {
        if (allowPartial) {
            let keys = Object.keys(this.hashLookup)
                .filter(k => k.slice(0, hashKey.length) === hashKey);
            if (keys.length === 1)
                return this.at(keys[0]);
            else if (keys.length === 0)
                return undefined;
            else
                return keys.map(key => this.at(key));
        }
        else
            return this.at(hashKey);
    }

    hasKey(id) {
        return (id in this.hashLookup) || super.hasKey(id);
    }

    /**
     * Remove n nodes from the list
     * @param {number} n The number of items to remove.
     */
    pop(n = 1) {
        let results = [];
        while (n--) {
            results(super.pop());
        }
        return results;
    }

    remove(index, count = 1) {
        if (typeof index === 'number') {
            let entry = this.index[index];
            if (entry) {
                if (entry.hashKey && this.hashLookup)
                    delete this.hashLookup[entry.hashKey];
                return super.remove(index, count);
            }
        }
        else {
            let hashValue = this.keyLookup(index);
            if (hashValue in this.hashLookup) {
                return this.remove(this.hashLookup[hashValue]);
            }
        }
        return false;
    }
}

class LinkedListWithLookup extends LinkedList {
    constructor(initialValue = [], hashKey = '') {
        super(Array.isArray(initialValue) ? initialValue : []);

        if (typeof initialValue === 'string')
            hashKey = initialValue;

        if (typeof (this.hashKey = hashKey) === 'string') {
            this.keyLookup = (o) => { return o[this.hashKey]; };
        }
        else if (Array.isArray(hashKey)) {
            hashKey.forEach((e, i) => {
                if (typeof e !== 'string')
                    throw new Error(`All elements of key must be type string; Type at index ${i} was '${typeof e}'`);
            });
            this.keyLookup = (o) => {
                let str = this.hashKey.map(k => o[k]).join('.'),
                    hash = crypto.createHash('md5').update(str).digest('hex');
                return hash;
            }
        }
        else if (typeof this.hashKey === 'function') {
            this.keyLookup = hashKey;
        }
        else
            throw new Error(`Unsupported type of hashKey: ${typeof this.hashKey}`);

        /** @type {Object.<string,number[]> */
        this.hashLookup = {};
    }

    add(value) {
        let hashKey = this.keyLookup(value);

        if (typeof hashKey === 'undefined')
            throw new Error(`Item cannot be added to collection; Failed to create valid hash key`);

        if (hashKey in this.hashLookup === false) {
            this.hashLookup[hashKey] = [];
        }
        let index = super.add(value);

        this.index[index].hashKey = hashKey;
        this.hashLookup[hashKey].push(index);

        return index;
    }

    /**
     * Returns the element at a particular numeric index
     * @param {number|string} pos The position to try and retrieve from.
     */
    at(pos) {
        if (typeof pos === 'string') {
            if (pos in this.hashLookup)
                pos = this.hashLookup[pos];
            else
                return false;
        }
        return super.at(pos);
    }

    /**
     * Look for an element using its hash key
     * @param {string} hashKey The value to look for
     * @param {boolean} allowPartial Allow lookup based on partial id
     */
    find(hashKey, allowPartial = false) {
        if (allowPartial) {
            let keys = Object.keys(this.hashLookup)
                .filter(k => k.slice(0, hashKey.length) === hashKey);

            if (keys.length === 0)
                return undefined;
            else if (keys.length === 1) {
                let result = this.hashLookup[keys[0]];
                return result.length === 1 ? this.at(result[0]) : result.map(i => this.at(i));
            }
            else {
                let result = [];
                keys.forEach(key => {
                    let result = this.hashLookup[key];
                    result.push(...result);
                });
                return result.map(i => this.at(i));
            }
        }
        else {
            let result = this.at(hashKey);
            if (!result)
                return undefined;
            else
                return result.length === 1 ? result[0] : result;
        }
    }

    hasKey(id) {
        return (id in this.hashLookup) || super.hasKey(id);
    }

    hasValue(value) {
        return this.hasKey(this.keyLookup(value));
    }

    remove(index, count = 1) {
        if (typeof index !== 'number') {
            throw new Error('Items cannot be removed from collection by ID');
        }
        let entry = this.index[index];
        if (entry) {
            let hashKey = entry.hashKey;
            if (hashKey in this.hashLookup) {
                let pos = this.hashLookup[hashKey].indexOf(index);
                this.hashLookup[hashKey].splice(pos, 1);
                if (this.hashLookup[hashKey].length === 0)
                    delete this.hashLookup[hashKey];
            }
            return super.remove(index, count);
        }
    }
}

module.exports = { LinkedList, LinkedListWithID, LinkedListWithLookup };
