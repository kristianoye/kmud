/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for array stuff
 */

const { ExecutionContext, CallOrigin } = require("../ExecutionContext");

class ArrayHelper {
    /**
     * Find the intersection of two or more arrays
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any[]} a
     */
    static intersection(ecc, ...a) {
        let frame = ecc.push({ file: __filename, method: 'intersection', callType: CallOrigin.DriverEfun });
        try {
            let arrays = a.slice(0).filter(_ => Array.isArray(_));
            if (arrays.length === 1) return a[0];
            else if (arrays.length === 0) return [];
            else {
                let result = arrays[0].slice(0);
                for (let i = 1, m = arrays.length; i < m; i++) {
                    result = result.filter(_ => arrays[i].indexOf(_) > -1);
                }
                return result;
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Consolidates a number of short descriptions into an array to be used in a sentence.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string[]|MUDObject[]} arr An array of strings and/or MUD Objects.
     * @returns {string[]} A considated array (e.g. ["two swords", "three buckets"])
     * TODO: Make this a simulEfun
     */
    static consolidate(ecc, arr) {
        let frame = ecc.push({ file: __filename, method: 'consolidate', callType: CallOrigin.DriverEfun });
        try {
            let shorts = {};
            arr.map(s => typeof s === 'string' && s || unwrap(uw => uw.shortDesc) || false)
                .filter(s => s !== false)
                .forEach(s => shorts[s] = (shorts[s] || 0) + 1);
            return Object.keys(shorts)
                .map(s => driver.efuns.consolidate(shorts[s], s).ucfirst());
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = Object.freeze(ArrayHelper);
