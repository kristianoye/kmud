/*
    The SimulEfun object provides additional API methods to in-game objects.
*/
export default final class SimulEfuns extends EFUNProxy {
    get testValue() {
        return 42;
    }

    appendArticle(what) {
        let name = unwrap(what, (ob) => ob.name) || what;
        if (typeof name !== 'string')
            throw `Bad argument 1 to appendArticle; Expected string or object but got ${typeof name}`;
        return (name.match(/^[aeiou]/) ? 'an ' : 'a ') + name;
    }

    consolidate(c, word) {
        if (c === 1) return word;
        else
            return this.cardinal(c) + ' ' +
                this.pluralize(
                    this.removeArticle(word));
    }

    /**
     * Largely stolen from Nightmare MUDLib
     * @param {number} x The number to convert.
     * @returns {string} The resulting string.
     */
    cardinal(x) {
        let tmp = "", a;
        if (x === 0)
            return "zero";
        if (x < 0) {
            tmp = "negative ";
            x = Math.abs(x);
        }
        switch (x) {
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
                if (x > 1000000000) return "over a billion";
                else if ((a = Math.floor(x / 1000000)) > 0) {
                    if ((x = Math.floor(x % 1000000)))
                        return `${this.cardinal(a)} million ${this.cardinal(x)}`;
                    else return `${this.cardinal(a)} million`;
                }
                else if ((a = Math.floor(x / 1000))) {
                    if ((x = Math.floor(x % 1000)))
                        return `${this.cardinal(a)} thousand ${this.cardinal(x)}`;
                    else return `${this.cardinal(a)} thousand`;
                }
                else if ((a = Math.floor(x / 100))) {
                    if ((x = Math.floor(x % 100)))
                        return `${this.cardinal(a)} hundred ${this.cardinal(x)}`;
                    else return `${this.cardinal(a)} hundred`;
                }
                else {
                    a = x / 10;
                    if (x = x % 10) tmp = "-" + this.cardinal(x);
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

    /**
     * Convert a variable into a string (not versible like JSON)
     * @param {any} value The value to stringify.
     * @returns {string} A string representation of the data.
     */
    identify(value) {
        let target = unwrap(value) || value;
        if (Array.isArray(target)) {
            return '[' + target.map((v, i) => {
                return this.identify(v);
            }) + ']';
        }
        else if (target instanceof MUDObject) {
            //target->HelloWorld();
            return `OBJ(${target.keyId} ${target.filename})`;
        }
        else if (typeof target === 'function') {
            var fn = /function\s+([^\s\(+])/.exec(target);
            return 'Function: ' + (fn ? fn[1] || '[anonymous]' : '[anonymous]') + '()';
        }
        else if (typeof target === 'boolean') {
            return target ? 'true' : 'false';
        }
        else if (typeof target === 'string') {
            return `"${target}"`;
        }
        else if (typeof target === 'number') {
            return target.toString();
        }
        else if (typeof target === 'object') {
            if (target === null)
                return 'null';

            var result = [];
            return '{ ' + Object.keys(target)
                .map(k => k + ':' + this.identify(target[k]))
                .join(', ') + ' }';
        }
        else if (typeof target === 'undefined') {
            return 'undefined';
        }
        else {
            throw `Uhandled type in identify(): ${typeof target}`;
        }
    }

    objective(target, perspective) {
        return unwrap(target, (ob) => {
            let gender = ob.gender;
            if (ob === unwrap(perspective))
                return 'you';
            else if (gender === 'male') return 'him';
            else if (gender === 'female') return 'her';
            else return 'it';
        }) || 'it';
    }

    ordinal(x) {
        let suffix, a;
        x = Math.abs(x);
        if (x > 10 && x < 14) suffix = 'th';
        switch (x % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
            default: suffix = 'th'; break;
        }
        switch (x) {
            case 1: return "first";
            case 2: return "second";
            case 3: return "third";
            case 4: return "fourth";
            case 5: return "fifth";
            case 6: return "sixth";
            case 7: return "seventh";
            case 8: return "eighth";
            case 9: return "ninth";
            case 10: return "tenth";
            case 11: return "eleventh";
            case 12: return "twelth";
            case 13: return "thirteenth";
            case 14: return "forteenth";
            case 15: return "fifteenth";
            case 16: return "sixteenth";
            case 17: return "seventeenth";
            case 18: return "eighteenth";
            case 19: return "nineteenth";
            default:
                if (x > 1000000000) return "over a billion";
                else if (a = Math.floor(x / 1000000)) {
                    if (x = Math.floor(x % 1000000))
                        return `${this.cardinal(a)} million ${this.ordinal(x)}`;
                    else return `${this.cardinal(a)} million${suffix}`;
                }
                else if (a = Math.floor(x / 1000)) {
                    if (x = Math.floor(x % 1000))
                        return `${this.cardinal(a)} thousand ${this.ordinal(x)}`;
                    else return `${this.cardinal(a)} thousand${suffix}`;
                }
                else if (a = Math.floor(x / 100)) {
                    if (x = Math.floor(x % 100))
                        return `${this.cardinal(a)} hundred ${this.ordinal(x)}`;
                    else return `${this.cardinal(a)} hundred${suffix}`;
                }
                else {
                    a = x / 10;
                    if (x = x % 10) tmp = "-" + this.cardinal(x);
                    else tmp = "";
                    switch (a) {
                        case 2: return "twenty" + tmp + suffix;
                        case 3: return "thirty" + tmp + suffix;
                        case 4: return "forty" + tmp + suffix;
                        case 5: return "fifty" + tmp + suffix;
                        case 6: return "sixty" + tmp + suffix;
                        case 7: return "seventy" + tmp + suffix;
                        case 8: return "eighty" + tmp + suffix;
                        case 9: return "ninety" + tmp + suffix;
                        default: return "error";
                    }
                }
        }
    }

    possessive(target, perspective) {
        return unwrap(target, (ob) => {
            let gender = ob.gender;
            if (ob === unwrap(perspective))
                return 'your';
            else if (gender === 'male') return 'his';
            else if (gender === 'female') return 'her';
            else return 'its';
        }) || 'its';
    }

    reflexive(target, perspective) {
        return unwrap(target, (ob) => {
            let gender = ob.gender;
            if (ob === unwrap(perspective))
                return 'yourself';
            else if (gender === 'male') return 'himself';
            else if (gender === 'female') return 'herself';
            else return 'itself';
        });
    }

    removeArticle(str) {
        return str.replace(/^(?:a|the|an|el) /i, '');
    }
}
