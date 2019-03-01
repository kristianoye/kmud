/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Provides a base class for user input types.
 */

class BaseInput {
    /**
     * Construct an input
     * @param {string} type The type of input
     * @param {{ onError: function(text) }} opts
     */
    constructor(type, opts = {}) {
        Object.keys(opts).forEach(key => {
            this[key] = opts[key];
        });

        this.onError = opts.onError;
        this.type = type;
    }

    /**
     * Normalize the user's input
     * @param {string} input The user's original input text
     * @param {MUDClient} client The client 
     * @returns {string} The normalized input to be used
     */
    normalize(input, client) {
        let result = this._normalize(input, client);
        if (result instanceof Error) {
            if (this.onError && this.onError(input))
                return undefined;
            return result;
        }
        return result;
    }

    _normalize() {
        throw new Error('_normalize() is not implemented');
    }

    render(client) {
        switch (client.clientType) {
            case 'html':
                return this.renderHtml(client);

            case 'text':
            default:
                return this.renderText(client);
        }
    }

    renderHtml(client) {
        throw new Error('renderHtml() not implemented');
    }

    /**
     * */
    renderText(client) {
        throw new Error('renderText() not implemented');
    }

    /**
     * Allows control to do sanity check on state
     * @param {function(string):void} callback The callback to fire when the user enters input
     */
    validate(callback) {
        if (this._validate()) {
            this.callback = callback;
            return Object.freeze(this);
        }
        throw new Error('Input validation error');
    }

    _validate() {
        throw new Error('_validate() is not implemented');
    }
}

const
    KnownTypes = [],
    InputTypes = {
        BaseInput,
        create: function (type, opts = {}, callback) {
            if (typeof type === 'string' && type in InputTypes === false) {
                if (typeof opts === 'object') {
                    opts.text = type;
                    type = opts.type || 'text';
                }
                else {
                    opts = { text: type };
                    type = 'text';
                }
            }
            else if (typeof type === 'object') {
                opts = Object.assign(opts || {}, type);
                type = opts.type || 'text';
            }
            if (typeof type !== 'string')
                throw new Error(`Bad argument 1  to BaseInput.create(); Expected string|object but got ${typeof type}`);
            let typeName = type.toLowerCase();
            if (typeName in InputTypes) {
                let typeConstructor = InputTypes[typeName],
                    instance = new typeConstructor(type, opts);
                return instance.validate(callback);
            }
            throw new Error(`Input type ${type} does not appear to exist`)
        },
        defineInputType: function (type, typeName) {
            if (type instanceof BaseInput.constructor === false) {
                throw new Error(`Type ${type.constructor.name} is not a valid input type`);
            }
            typeName = typeName || type.name.toLowerCase();
            if (typeName.endsWith('input')) typeName = typeName.slice(0, -5);
            InputTypes[typeName] = type;
            KnownTypes.push(typeName);
            return type;
        },
        knownType: function (s) {
            return KnownTypes.indexOf(s) > -1;
        }
    };

module.exports = InputTypes;

require('./TextInput');
require('./YesNoInput');
require('./PickOne');

