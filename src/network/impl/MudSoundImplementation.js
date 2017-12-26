﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Provides a base abstraction for playing MUD sounds and music.
 */

class MudSoundImplementation {
    playMusic() {

    }

    playSound() {

    }
}

/**
 * @param {string} terminalType The terminal type to create a sound implementation for.
 * @returns {MudSoundImplementation}
 */
MudSoundImplementation.createImplementation = function (terminalType) {
    let
        implementationType = MudSoundImplementation;

    switch (terminalType) {
        case 'kmud':
            implementationType = require('./kmud/KmudSoundSupport');
            break;

        case 'zmud':
        case 'cmud':
            implementationType = require('./zmud/MudSoundProtocol');
            break;
    }

    return new implementationType();
};

module.exports = MudSoundImplementation;
