/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2019
 * 
 * Data structure that is array-like but preserves 
 */

/** @typedef {{ index: number, value: any, next: LinkedListNode, prev: LinkedListNode }} LinkedListNode */

class LinkedList {
    constructor() {
        this.length = 0;
        this.nextId = 0;

        /** @type {Object.<number, LinkedListNode>} */
        this.index = {};

        /** @type {LinkedListNode} */
        this.head = false;

        /** @type {LinkedListNode} */
        this.tail = false;
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
        return entry.index;
    }

    /**
     * Returns the element at a particular numeric index
     * @param {number} pos The position to try and retrieve from.
     */
    at(pos) {
        return this.index[pos];
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
     * Convert the items in the collection to an array 
     */
    toArray() {
        let result = [];
        this.forEach(val => result.push(val));
        return result;
    }
}

module.exports = LinkedList;

