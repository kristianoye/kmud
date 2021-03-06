﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains helpers to parse and validate MUD config.
 */
const
    path = require('path'),
    fs = require('fs');

class ConfigUtil {
    /**
     * Check to see if the specified directory exists.
     * @param {string[]} expr One or more paths to join together.
     */
    assertExists(...expr) {
        expr.unshift(__dirname);
        let fileToCheck = path.join(...expr);
        if (!fileToCheck.endsWith('.js')) fileToCheck += '.js';
        if (!fs.existsSync(fileToCheck)) {
            throw new Error(`File ${fileToCheck} does not exist!`);
        }
    }

    assertType(val, key, ...typeList) {
        for (let i = 0, myType = typeof val; i < typeList.length; i++) {
            if (myType === typeList[i]) return true;
        }
        throw new Error(`Setting for ${key} has invalid type; Expected ${typeList.join('|')} but got ${typeof val}`);
    }

    assertRange(val, key, min, max) {
        this.assertType(val, key, 'number');
        if (val < min || val > max)
            throw new Error(`Setting for ${key} is invalid; Value must be between ${min} and ${max} but got ${val}`);
    }

    /**
     * Parse a string into a numeric time expression.
     * @param {string} dateStr The expression to parse (e.g. 1h30m)
     * @returns {number} The expression in seconds.
     */
    parseTime(dateStr) {
        if (typeof dateStr === 'number')
            return dateStr;
        else if (typeof dateStr !== 'string')
            return dateStr;

        dateStr = dateStr.replace(/[^a-zA-Z0-9\.]+/, '').toLowerCase();
        let re = /([\d\.]+)([^\d]+)/g,
            m = re.exec(dateStr), r = 0;
        while (m) {
            let t = parseFloat(m[1]), u = m[2];
            switch (u.charAt(0)) {
                case 'd': r += t * 24 * 60 * 60 * 1000; break;
                case 'h': r += t * 60 * 60 * 1000; break;
                case 'm': r += t * 60 * 1000; break;
                case 's': r += t * 1000; break;
                default: throw new Error(`Invalid timespan expression: ${m[0]}`);
            }
            m = re.exec(dateStr);
        }
        return r;
    }

    resolvePath(p1, ext) {
        var p2 = path.join(__dirname, p1);
        return p2.endsWith(ext || '.js') ? p2 : p2 + (ext || '.js');
    }
}

module.exports = new ConfigUtil();

