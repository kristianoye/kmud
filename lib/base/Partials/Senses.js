/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

class Senses extends MUDMixin {
    get senses() {
        return get({
            smells: {},
            sounds: {}
        });
    }
}

module.exports = Senses;
