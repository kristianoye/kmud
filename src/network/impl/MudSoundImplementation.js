/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Provides a base abstraction for playing MUD sounds and music.
 */

const
    ClientImplementation = require('./ClientImplementation');

class MudSoundImplementation extends ClientImplementation {
    constructor(caps) {
        super(caps);
        this.caps.sound = this.caps.music = this;
    }

    playMusic() {

    }

    playSound() {

    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateFlags(flags) {
        flags.music = false;
        flags.sound = false;
        return this;
    }
}

module.exports = MudSoundImplementation;
