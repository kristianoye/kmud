/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Weapon = await requireAsync(Base.Weapon);

class SwordOfDestiny extends Weapon {
    create() {
        this.name = 'sword';
        this.idList = ['sword', 'weapon'];
        this.shortDesc = 'Sword of Destiny';
        this.longDesc = 'The sword of 1000 truths and the sword of destiny... all rolled into one!';
    }
}

module.exports = SwordOfDestiny;
