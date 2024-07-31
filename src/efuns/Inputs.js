/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Helper methods for user input interactions
 */
const { ExecutionContext, CallOrigin, ExecutionFrame } = require('../ExecutionContext');
const
    BaseInput = require('../inputs/BaseInput'),
    InputTypes = require('../inputs/InputTypes');

class InputHelper {
    static get InputType() {
        return InputTypes;
    }

    /**
     * Prompt the current user for input
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} type The type of input to render
     * @param {any} options
     * @param {any} callback
     */
    static prompt(ecc, type, options = {}, callback = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'prompt', callType: CallOrigin.DriverEfun });
        try {
            if (typeof options === 'string') {
                options = { text: options };
            }
            if (typeof type === 'string') {
                if (!BaseInput.knownType(type)) {
                    options = Object.assign({ text: type }, options);
                    type = 'text';
                }
            }
            if (typeof callback === 'function')
                options.callback = callback;

            options = Object.assign({
                default: false,
                text: 'Prompt: ',
                type: 'text'
            }, options);

            let prompt = BaseInput.create(type, options, typeof options.callback === 'function' && options.callback);

            frame.context.shell.addPrompt(frame.branch(), prompt);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Prompt the current user for input
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} type The type of input to render
     * @param {any} opts
     * @returns
     */
    static async promptAsync(ecc, type, opts = {}) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'promptAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (typeof opts === 'string') {
                opts = { text: opts };
            }

            if (typeof type === 'string') {
                if (!BaseInput.knownType(type)) {
                    opts = Object.assign({ text: type }, opts);
                    type = 'text';
                }
            }

            opts = Object.assign({
                default: false,
                text: 'Prompt: ',
                type: 'text'
            }, opts, { isAsync: true });

            return new Promise((resolve, reject) => {
                if (ecc && ecc.shell) {
                    try {
                        let prompt = BaseInput.create(type, opts),
                            originalCallback = typeof prompt.callback === 'function' && prompt.callback;

                        prompt.callback = (input) => {
                            try {
                                if (originalCallback)
                                    originalCallback(input);
                                resolve(input);
                            }
                            catch (err) {
                                reject(err);
                            }
                        };
                        ecc.shell.addPrompt(frame.branch(), prompt);
                    }
                    catch (err) {
                        reject(err);
                    }
                }
                else
                    reject('No command shell present');
            });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Splits a string into command arguments; Quoted values return as a single arg.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} inputIn The input to parse
     * @param {boolean} preserveWhitespaceIn
     * @returns {string[]} Returns the input split into argument form
     */
    static splitArgs(ecc, inputIn, preserveWhitespaceIn = false) {
        /** @type {[ExecutionFrame, string, boolean]} */
        let [frame, input, preserveWhitespace] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'promptAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let text = input.trim(),
                isEscaped = false,
                isString = false,
                current = '',
                args = [],
                i = 0, s = 0,
                m = text.length,
                last = m - 1,
                eatWhitespace = () => {
                    let ws = '';
                    while (i < m && /\s+/.test(text.charAt(i)))
                        ws += text.charAt(i++);
                    return preserveWhitespace ? ws : '';
                };

            for (let c, n = false; c = text.charAt(i), i < m; n = text.charAt(i + 1), i++) {
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
                            if (current) {
                                args.push(current);
                            }
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

            if (current) {
                args.push(current);
            }

            return args;
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = InputHelper;
