/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2019
 * 
 * Data structure that is array-like but preserves 
 */

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
        return this.index[pos];
    }

    /** Returns the first element */
    first() {
        return this.head ? this.head : false;
    }

    /**
     * Determine if the key is in the collection.
     * @param {any} id
     */
    hasKey(id) {
        return id in this.index;
    }

    get last() {
        return this.tail ? this.tail : false;
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
     * @returns {LinkedListNode|false} Returns the next node or false if its the end
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
     * @returns {LinkedListNode|false} Returns the previous node or false if its the end
     */
    prev(id) {
        let node = typeof id === 'number' ? this.index[id] : this.index[id.index];
        if (!node)
            throw new Error(`Null exception; Index ${id} does not exist`);
        return node.prev ? node.prev : false;
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

    /**
     * Returns a subset of the items
     * @param {number} index The index to start taking elements from
     * @param {any} count THe number of items to retrieve.
     */
    slice(index = -1, count = 1) {
        let result = [], start = this.index[index = index > -1 ? index : this.min];

        if (!start)
            return [];

        while (count--) {
            result.push(start.value);
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
}

class LinkedListWithID extends LinkedList {
    constructor(initialValue = [], hashKey = '') {
        super(Array.isArray(initialValue) ? initialValue : []);

        if (typeof initialValue === 'string')
            hashKey = initialValue;

        if (typeof (this.hashKey = hashKey) !== 'string')
            throw new Error(`Hash key should be a string`);
        else if (hashKey.length === 0)
            throw new Error(`Hash key cannot be zero bytes`);
        this.hashLookup = {};
    }

    add(value) {
        let hashKey = value[this.hashKey];

        if (typeof hashKey === 'undefined')
            throw new Error(`Item cannot be added to collection; It is missing required property ${this.hashKey}`);

        if (hashKey in this.hashLookup)
            throw new Error(`Collection already contains a value with '${this.hashKey}' of '${hashKey}'`);

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

    remove(index, count = 1) {
        if (index in this.hashLookup) {
            return this.remove(this.hashLookup[index]);
        }
        else {
            let entry = this.index[index];
            if (entry) {
                if (entry.hashKey)
                    delete this.hashlook[entry.hashKey];
                return super.remove(index, count);
            }
        }
    }
}

class LinkedListWithLookup extends LinkedList {
    constructor(initialValue = [], hashKey = '') {
        super(Array.isArray(initialValue) ? initialValue : []);

        if (typeof initialValue === 'string')
            hashKey = initialValue;

        if (typeof (this.hashKey = hashKey) !== 'string')
            throw new Error(`Hash key should be a string`);
        else if (hashKey.length === 0)
            throw new Error(`Hash key cannot be zero bytes`);

        /** @type {Object.<string,number[]> */
        this.hashLookup = {};
    }

    add(value) {
        let hashKey = value[this.hashKey];

        if (typeof hashKey === 'undefined')
            throw new Error(`Item cannot be added to collection; It is missing required property ${this.hashKey}`);

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
                let result = this.this.hashLookup[keys[0]];
                return result.length === 1 ? result[0] : result;
            }
            else {
                let result = [];
                keys.forEach(key => {
                    let result = this.this.hashLookup[key];
                    result.push(...result);
                });
                return result;
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

    remove(index, count = 1) {
        if (typeof index === 'string') {
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
