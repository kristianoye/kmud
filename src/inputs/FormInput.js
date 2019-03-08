/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Renders a composite of other input types and waits for all 
 */
const
    BaseInput = require('./BaseInput');

class FormInput extends BaseInput {
    constructor(type, opts = {}) {
        super(type, opts);

        if (Array.isArray(opts.controls)) {
            input('form', {
                controls: {
                    Username: { type: 'text', text: 'Username:' },
                    Password: { type: 'password', text: 'Password: ' },
                }
            });
        }
    }
}

BaseInput.defineInputType(FormInput, 'form');

module.exports = FormInput;
