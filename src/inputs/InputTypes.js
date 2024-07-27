/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 22, 2019
 *
 * Provides a base class for user input types.
 */

const
    InputTypeHtmlForm = 'html-form',
    InputTypePassword = 'password',
    InputTypePickOne = 'pickone',
    InputTypeText = 'text',
    InputTypeYesNo = 'yes-no',
    InputTypes = Object.freeze({
        InputTypeHtmlForm,
        InputTypePassword,
        InputTypePickOne,
        InputTypeText,
        InputTypeYesNo
    });

module.exports = InputTypes;
