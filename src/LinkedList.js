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

module.exports = LinkedList;

