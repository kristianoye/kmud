/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    GameObject = await requireAsync('./GameObject');

class Armor extends GameObject {
    get armorClass() {
        return get(0);
    }

    set armorClass(value) {
        if (typeof value === 'number') set(value);
    }

    get bodyType() {
        return get('human');
    }

    set bodyType(value) {
        if (typeof value === 'string' && value.length > 0)
            set(value);
    }

    /** 
     * Indicates which limbs are protected by this armor
     * @type {string[]}
     */
    get limbs() {
        return get([]);
    }

    protected set limbs(value) {
        if (Array.isArray(value))
            set(value.filter(a => typeof a === 'string'));
    }

    get size() {
        return get(0);
    }

    set size(value) {
        if (typeof value === 'number' && value > 0)
            set(value);
    }
}

module.defaultExport = Armor;

