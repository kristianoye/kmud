/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: September 25, 2020
 *
 */
class CacheItem  {
    constructor(item, key) {
        this.value = item;
        this.hashKey = key;
        this.lastAccessed = Date.now();

        /** @type {CacheItem} */
        this.next = null;

        /** @type {CacheItem} */
        this.prev = null;

        this.hits = 0;
    }
}

class Cache {
    /**
     * A cache object for storing items of a particular type.
     * @param {{ capacity: number, key: string|string[]|function(any):string }} options Options for constructing the cache
     */
    constructor(options) {
        this.capacity = options.capacity;

        this.hits = 0;
        this.misses = 0;
        this.requests = 0;

        /** @type {CacheItem} */
        this.first = null;

        /** @type {CacheItem} */
        this.last = null;

        this.count = 0;

        if (typeof (this.keyDef = options.key) === 'string') {
            this.keyGenerator = (o) => { return o[this.keyDef] };
        }
        else if (Array.isArray(this.keyDef)) {
            this.keyGenerator = (o) => {
                return this.keyDef.forEach(k => o[k]).join('.');
            }
        }
        else if (typeof this.keyDef === 'function') {
            this.keyGenerator = this.keyDef;
        }
        /** @type {Object.<string,CacheItem>} */
        this.hashLookup = {};
    }

    clear() {
        this.hashLookup = {};
        this.first = null;
        this.last = null;
        this.count = 0;
    }

    /**
     * Returns true if the item specified is in the cache
     * @param {any} item
     */
    contains(item) {
        let hashValue = this.keyGenerator(item);
        return hashValue in this.hashLookup;
    }

    get efficiency() {
        return (this.hits / this.requests) * 100.00;
    }

    /**
     * Attempt to get an item from the cache
     * @param {any} key The key to look up
     */
    get(key) {
        this.requests++;

        if (key in this.hashLookup) {
            let item = this.hashLookup[key];
            this.moveToFront(item);
            this.hits++;
            return item.value;
        }
        this.misses++;
        return undefined;
    }

    /**
     * Move a cached item to the front of the cache
     * @param {CacheItem} item
     */
    moveToFront(item) {
        let prev = item.prev,
            next = item.next;

        //  Take this item out of its previous position
        if (prev) prev.next = next;
        if (next) next.prev = prev;

        //  Move this item into the first position
        if (this.first) {
            this.first.prev = item;
            item.next = this.first;
        }
        if (!this.last) {
            this.last = item;
        }
        this.first = item;
        item.prev = null;
        item.lastAccessed = Date.now();
        item.hits++;
    }

    /** Ensure we don't exceed our capacity */
    purge() {
        while (this.count >= this.capacity) {
            let last = this.last,
                prev = last.prev;
            this.last = prev;
            this.last.next = null;
            count--;
        }
    }

    /**
     * Store a value in the cache
     * @param {any} value
     * @param {string} key The specific key to cache
     */
    store(value) {
        let key = this.keyGenerator(value), item;

        if (key in this.hashLookup === false) {
            //  The new item goes in at the beginning
            this.purge();
            item = this.hashLookup[key] = new CacheItem(value, key);
            this.count++;
        }
        else
            item = this.hashLookup[key];
        this.moveToFront(item);
        return value;
    }

    get length() {
        return this.count;
    }
}

module.exports = Cache;
