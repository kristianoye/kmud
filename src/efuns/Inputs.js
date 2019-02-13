/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Helper methods for user input interactions
 */

class InputHelper {

    /**
     * Splits a string into verb and statement
     * @param {string} input The text to split
     * @returns {[string,string]} The verb and text
     */
    static getVerb(input) {
        let text = input.trim(), i = 0, m = text.length;
        while (i < m && !/\s/.test(text.charAt(i))) i++;
        return [text.slice(0, i), text.slice(i).trim()];
    }

    /**
     * Splits a string into command arguments; Quoted values return as a single arg.
     * @param {string} input The input to parse
     * @returns {string[]} Returns the input split into argument form
     */
    static splitArgs(input, preserveWhitespace = false) {
        let text = input.trim(),
            isEscaped = false,
            isString = false,
            current = '',
            result = [],
            i = 0, s = 0,
            m = text.length,
            last = m - 1,
            eatWhitespace = () => {
                let ws = '';
                while (i < m && /\s+/.test(text.charAt(i)))
                    ws += text.charAt(i++);
                return preserveWhitespace ? ws : '';
            };

        for (let c; c = text.charAt(i), i < m; i++) {
            if (isEscaped) {
                current += c, isEscaped = false;
                continue;
            }
            switch (text.charAt(i)) {
                case '\\':
                    if (i === last)
                        throw new Error(`Bad argument 1 to splitArgs: Last character cannot be an escape character.`);
                    isEscaped = true;
                    break;

                case '"':
                case "'":
                    if (isString && isString === c) {
                        isString = false;
                    }
                    else if (isString) {
                        current += c;
                    }
                    else {
                        isString = c;
                        s = i;
                    }
                    continue;

                default:
                    if (/\s/.test(c) && !isString) {
                        current += eatWhitespace();
                        if (current) result.push(current);
                        current = '';
                        i--;
                    }
                    else {
                        current += c;
                    }
            }
        }
        if (isString)
            throw new Error(`Bad argument 1 to splitArgs: Unterminated string staring at position ${s}`);
        if (current) result.push(current);
        return result;
    }

    /**
     * Splits a line of text into component parts.
     * @param {string} original The text to split
     * @param {boolean} [returnArgs] Also split the remaining text into an array
     * @returns {{ verb: string, text: string, args: string[], original: string }} Returns command components
     */
    static splitCommand(original, returnArgs = false) {
        let [verb, text] = InputHelper.getVerb(original);
        if (returnArgs) {
            return {
                verb,
                text,
                original,
                args: InputHelper.splitArgs(text.slice(0))
            };
        }
        return {
            verb,
            text,
            original,
            args: false
        };
    }
}

module.exports = InputHelper;
