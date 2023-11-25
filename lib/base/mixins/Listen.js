/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

abstract class Listen {
    create() {
        this.sounds = {};
    }

    get defaultSound() {
        return get('');
    }

    set defaultSound(sound) {
        if (typeof sound === 'string' || typeof sound === 'function')
            set(sound);
    }

    get sounds() {
        return get({});
    }

    set sounds(soundMapping) {
        if (typeof soundMapping === 'object') {
            let valid = {};

            for (const [soundName, sound] of Object.entries(soundMapping)) {
                if (typeof sound === 'string' || typeof sound === 'function')
                    valid[soundName] = sound;
            }
            set(valid);
        }
    }

    directListenToObject(o) {
        return 1;
    }

    directListenToObject(target, container) {
        return true;
    }

    indirectListenToObjectInObject(target, container) {
        return true;
    }
}

module.exports = Listen;
