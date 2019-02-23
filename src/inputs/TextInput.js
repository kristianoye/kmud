/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Provides support for entering text or passwords.
 */
const
    BaseInput = require('./BaseInput');

class TextInput extends BaseInput.BaseInput {
    _normalize(text) {
        if (this.minLength && text.length < this.minLength)
            return Error(this.minLengthError || `Value '${text}' is too short (${text.length} < ${this.minLength})`);
        else if (this.maxLength && text.length > this.maxLength)
            return Error(this.maxLengthError || `Value '${text}' is too long (${text.length} > ${this.maxLength})`);
        else if (this.matches instanceof RegExp && !this.matches.test(text))
            return Error(this.matchesError || `Value '${text}' is not in the correct format`);
        return text;
    }

    renderHtml(client) {

    }

    /**
     * Render the prompt for a text-based client
     * @param {MUDClient} client The client to render for
     */
    renderText(client) {
        client.toggleEcho(this.type !== 'password');
        client.write(this.text);
    }

    _validate() {
        if (!this.text)
            throw new Error(`Input of type ${this.type} should have property "text"`);

        if ('minLength' in this) {
            if (typeof this.minLength !== 'number')
                throw new Error('Property minLength must be numeric');
            if (this.minLength < 0)
                throw new Error('Property minLength must be a positive value');
        }

        if ('maxLength' in this) {
            if (typeof this.maxLength !== 'number')
                throw new Error('Property maxLength must be numeric');
            if (this.maxLength < 0)
                throw new Error('Property maxLength must be a positive value');
        }
        return true;
    }
}

module.exports = {
    TextInput: BaseInput.defineInputType(TextInput),
    PasswordInput: BaseInput.defineInputType(TextInput, 'password')
};
