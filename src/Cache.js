/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: September 25, 2020
 *
 */
class CacheItem  {
    constructor(item, position = 0) {
        super();
        this.value = item;
        this.lastAccessed = Date.now();
        this.position = position;
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
        super(undefined, options.key);
        this.capacity = options.capacity;

        this.hits = 0;
        this.misses = 0;
        this.attempts = 0;

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
     * Attempt to get an item from the cache
     * @param {string} key The key to look up
     */
    get(key) {
        let hashValue = this.keyGenerator(key);
        this.attempts++;

        if (hashValue in this.hashLookup) {
            let item = this.hashLookup[hashValue];
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
            item.next = this.prev;
        }
        this.first = item;
        item.prev = null;
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
            item = this.hashLookup[key] = new CacheItem(value);
            this.count++;
        }
        else
            item = this.hashLookup[key];
        this.moveToFront(item);

        while (this.count > this.capacity) {
            let last = this.last,
                prev = last.prev;
            this.last = prev;
            this.last.next = null;
            count--;
        }
    }

    get length() {
        return this.count;
    }
}

module.exports = Cache;
