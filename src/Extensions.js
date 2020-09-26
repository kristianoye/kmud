/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */

function extendPrototype(pt, spec) {
    Object.keys(spec).forEach(fn => {
        if (typeof pt[fn] !== 'function') { pt[fn] = spec[fn]; }
    });
}


// Math extensions
(function () {
    /**
     * Decimal adjustment of a number.
     *
     * @param {String}  type  The type of adjustment.
     * @param {Number}  value The number.
     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
     * @returns {Number} The adjusted value.
     */
    function decimalAdjust(type, value, exp) {
        // If the exp is undefined or zero...
        if (typeof exp === 'undefined' || +exp === 0) {
            return Math[type](value);
        }
        value = +value;
        exp = +exp;
        // If the value is not a number or the exp is not an integer...
        if (value === null || isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return NaN;
        }
        // If the value is negative...
        if (value < 0) {
            return -decimalAdjust(type, -value, exp);
        }
        // Shift
        value = value.toString().split('e');
        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
        // Shift back
        value = value.toString().split('e');
        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }

    // Decimal round
    if (!Math.round10) {
        Math.round10 = function (value, exp) {
            return decimalAdjust('round', value, exp);
        };
    }
    // Decimal floor
    if (!Math.floor10) {
        Math.floor10 = function (value, exp) {
            return decimalAdjust('floor', value, exp);
        };
    }
    // Decimal ceil
    if (!Math.ceil10) {
        Math.ceil10 = function (value, exp) {
            return decimalAdjust('ceil', value, exp);
        };
    }
})();

// Object extensions
(function () {
    if (!Object.forEach)
        Object.forEach = function (target, callback) {
            if (typeof target !== 'object' || target === null)
                throw new Error('Bad argument 1 to Object.forEach');

            Object.getOwnPropertyNames(target).forEach(function (key) {
                callback.call(target, key, target[key]);
            });
            return target;
        };

    if (!Object.mapEach) 
        Object.mapEach = function (target, callback) {
            var arr = [], obj = {}, ac = 0, oc = 0, c = 0;
            if (typeof target !== 'object' || target === null)
                throw new Error('Bad argument 1 to Object.mapEach');

            Object.getOwnPropertyNames(target).forEach(key => {
                var result = callback.call(target, key, target[key], c++);
                if (typeof result !== 'undefined') {
                    if (Array.isArray(result) && result.length === 2) {
                        if (typeof result[0] !== 'string')
                            throw new Error('Key must be a string');
                        obj[result[0]] = result[1];
                        oc++;
                    }
                    else {
                        arr.push(result);
                        ac++;
                    }
                }
            });
            if (ac > 0 && oc > 0) {
                throw new Error(`Object.forEach returned ${oc} object key/value pairs and ${ac} array elements; Must be all of one type.`);
            }
            return ac > 0 ? arr : obj;
        };
})();
