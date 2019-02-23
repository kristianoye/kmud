/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Provides support for entering text or passwords.
 */
const
    Base = require('./BaseInput'),
    Types = {
        YesNo: 'yes-no',
        YesNoCancel: 'yes-no-cancel',
        AbortRetryFail: 'abort-retry-fail'
    },
    ValidTypes = [Types.YesNo, Types.YesNoCancel, Types.AbortRetryFail];

class YesNoInput extends Base.BaseInput {
    /**
     * @param {string} type The type of control to construct
     * @param {{ type: string, default: string, rederAs: string }} opts Options for the control
     */
    constructor(type, opts = {}) {
        super(type, opts);

        if (ValidTypes.indexOf(type) === -1)
            throw new Error(`Illegal type specifier; Expected '${ValidTypes.join('|')}' but got '${type}'`);

        this.default = opts.default;
        this.renderAs = opts.rederAs;
    }

    /** @type {string[]} */
    get options() {
        return this.type.split('-');
    }

    /**
     * Normalize the user input
     * @param {string} text
     */
    _normalize(text) {
        text = text || this.default;
        let findOne = this.options.filter(o => o.slice(0, text.length) === text);
        return findOne.length === 1 ? findOne[0] : 
            new Error(`Invalid option; Please respond with one of: ${this.options.join(', ')}`);
    }

    renderHtml(client) {

    }

    /**
     * Render the prompt for a text-based client
     * @param {MUDClient} client The client to render for
     */
    renderText(client) {
        let prompt = this.text.slice(0);
        let options = this.options.map(v => {
            if (v === this.default)
                return `[${v.charAt(0).toUpperCase()}]${v.slice(1)}`;
            else return `[${v.charAt(0)}]${v.slice(1)}`;
        });
        if (!/\s+$/.test(this.text)) prompt += ' ';
        prompt = prompt.trim() + ' ' + options.join('/') + ': ';
        client.write(prompt);
    }

    /** 
     * Validate the control 
     */
    _validate() {
        if (!this.text)
            throw new Error(`Input of type ${this.type} should have property "text"`);
        return true;
    }
}

Base.defineInputType(YesNoInput, Types.YesNo);
Base.defineInputType(YesNoInput, Types.YesNoCancel);
Base.defineInputType(YesNoInput, Types.AbortRetryFail);

module.exports = YesNoInput;
