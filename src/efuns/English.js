/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Helper methods for English-related tasks
 */

class EnglishHelpers {
    static appendArticle(what) {
        let name = unwrap(what, (ob) => ob.name) || what;
        if (typeof name !== 'string')
            throw new Error(`Bad argument 1 to appendArticle; Expected string or object but got ${typeof name}`);
        return (name.match(/^[aeiou]/) ? 'an ' : 'a ') + name;
    }

    static consolidate(c, word) {
        if (c === 1) return word;
        else
            return this.cardinal(c) + ' ' +
                this.pluralize(
                    this.removeArticle(word));
    }

    /**
     * Largely stolen from Nightmare MUDLib
     * @param {number} value The number to convert.
     * @returns {string} The resulting string.
     */
    static cardinal(value) {
        let tmp = "", a;
        if (value === 0)
            return "zero";
        if (value < 0) {
            tmp = "negative ";
            value = Math.abs(value);
        }
        switch (value) {
            case 1: return tmp + "one";
            case 2: return tmp + "two";
            case 3: return tmp + "three";
            case 4: return tmp + "four";
            case 5: return tmp + "five";
            case 6: return tmp + "six";
            case 7: return tmp + "seven";
            case 8: return tmp + "eight";
            case 9: return tmp + "nine";
            case 10: return tmp + "ten";
            case 11: return tmp + "eleven";
            case 12: return tmp + "twelve";
            case 13: return tmp + "thirteen";
            case 14: return tmp + "fourteen";
            case 15: return tmp + "fifteen";
            case 16: return tmp + "sixteen";
            case 17: return tmp + "seventeen";
            case 18: return tmp + "eighteen";
            case 19: return tmp + "nineteen";
            case 20: return tmp + "twenty";
            default:
                if (value > 1000000000) return "over a billion";
                else if ((a = Math.floor(value / 1000000)) > 0) {
                    if ((value = Math.floor(value % 1000000)))
                        return `${this.cardinal(a)} million ${this.cardinal(value)}`;
                    else return `${this.cardinal(a)} million`;
                }
                else if ((a = Math.floor(value / 1000))) {
                    if ((value = Math.floor(value % 1000)))
                        return `${this.cardinal(a)} thousand ${this.cardinal(value)}`;
                    else return `${this.cardinal(a)} thousand`;
                }
                else if ((a = Math.floor(value / 100))) {
                    if ((value = Math.floor(value % 100)))
                        return `${this.cardinal(a)} hundred ${this.cardinal(value)}`;
                    else return `${this.cardinal(a)} hundred`;
                }
                else {
                    a = value / 10;
                    if (value = value % 10) tmp = "-" + this.cardinal(value);
                    else tmp = "";
                    switch (a) {
                        case 2: return "twenty" + tmp;
                        case 3: return "thirty" + tmp;
                        case 4: return "forty" + tmp;
                        case 5: return "fifty" + tmp;
                        case 6: return "sixty" + tmp;
                        case 7: return "seventy" + tmp;
                        case 8: return "eighty" + tmp;
                        case 9: return "ninety" + tmp;
                        default: return "error";
                    }
                }
        }
    }
}

// module.exports = driver.instrumentObject(EnglishHelpers);
module.exports = EnglishHelpers;
