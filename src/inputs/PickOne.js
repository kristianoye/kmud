/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Renders a list of options and prompts the user to pick 
 * one or more values.
 */
const
    BaseInput = require('./BaseInput');

class PickOneInput extends BaseInput {
    /**
     * Construct a PickOneInput
     * @param {string} type The type of control being constructed
     * @param {Object.<string,string>} opts The extra settings
     */
    constructor(type, opts = {}) {
        super(type, opts);

        this.options = opts.options || false;
        this.renderAs = opts.renderAs || 'radiogroup';
    }

    /**
     * Normalize the user's input based on the rules of this input.
     * @param {string} text The user's raw input
     * @returns {string} The input after conforming to this control.
     */
    _normalize(text) {
        if (typeof this.options === 'object') {
            let opts = Object.keys(this.options);
            let disp = opts.slice(0, -1).join(', ') + ' or ' + opts.pop();
            let values = opts.map(key => this.options[key])
                .filter(val => text.length > 0 && val.slice(0, text.length) === text);

            if (this.options[text])
                return this.options[text];
            else if (values.length === 1)
                return values[0];
            else
                return Error(`Please select an item from the list (${disp}).`);
            return text;
        }
        else {

        }
    }

    /**
     * Render the control for a web client.
     * @param {MUDClient} client The client to render for
     */
    renderHtml(client) {
        if (this.renderAs === 'radiogroup') {

        }
    }

    /**
     * Render the prompt for a text-based client
     * @param {MUDClient} client The client to render for
     */
    renderText(client) {
        let prompt =  efuns.eol + `${this.text || 'Please choose from the following:'}:` + efuns.eol + efuns.eol;
        let list = [];

        if (this.compact === true)
            prompt = '';

        if (Array.isArray(this.options)) {
            this.options.forEach((o, i) => {
                prompt += `\t${i + 1}) $o` + efuns.eol;
                list.push(`${i + 1}`);
            });
            if (list.length > 9) list = [];
        }
        else if (typeof this.options === 'object') {
            for (let [key, val] of Object.entries(this.options)) {
                let pos = val.indexOf(key),
                    displayVal = val;
                if (pos > -1) {
                    displayVal = displayVal.slice(0, pos) + '[' + key + ']' + displayVal.slice(pos + key.length);
                    list.push(key);
                }
                if (this.compact === true) {
                    if (list.length > 1)
                        prompt += ', ';
                    prompt += displayVal;
                }
                else
                    prompt += `\t${displayVal}` + efuns.eol;
            }
        }
        else {
            throw new Error(`Bad argument for input type pickOne; Requires options to be object or array`);
        }
        if (this.compact !== true) {
            prompt += efuns.eol + `${this.prompt || 'Your choice'} `;

            if ('summary' in this && list.length > 0) {
                switch (this.summary) {
                    case '':
                        prompt += '[' + list.join('') + ']';
                        break;
                    case ',':
                        prompt += '[' + list.slice(0, -1).join(',') + ' or ' + list.pop() + ']';
                        break;
                }
            }
            prompt += ': ';
        }
        else {
            prompt = this.text + '[' + prompt + ']: ';
        }
        client.write(prompt);
    }

    _validate() {
        if (!this.text)
            throw new Error(`Input of type ${this.type} should have property "text"`);

        if (Array.isArray(this.options)) {
            this.options.forEach((v, i) => {
                if (typeof v !== 'string')
                    throw new Error(`All options must be of type string [value at index ${i} is ${typeof v}`);
            });
        }
        else if (typeof this.options === 'object') {
            Object.keys(this.options).forEach(key => {
                if (typeof key !== 'string')
                    throw new Error(`Option key ${key} must be type string`);
            });
        }
        else
            throw new Error(`Input type ${this.type} expects property 'options' of type Object or Array`);

        if ('renderAs' in this) {
            if (typeof this.renderAs !== 'string')
                throw new Error(`Property 'renderAs' for input type '${this.type}' must be string, not ${typeof this.renderAs}`);
            else if (['radiogroup', 'dropdown'].indexOf(this.renderAs)) {
                throw new Error(`Property 'renderAs' for input type '${this.type}' must be 'radiogroup' or 'dropdown', not '${this.renderAs}'`);
            }
        }

        return true;
    }
}

BaseInput.defineInputType(PickOneInput, 'pickone');

module.exports = PickOneInput;
