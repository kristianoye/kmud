/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_WEAPON } from 'Base';
import Weapon from LIB_WEAPON;

class SwordOfDestiny extends Weapon {
    override create() {
        this.name = 'sword';
        this.idList = ['sword', 'weapon'];
        this.shortDesc = 'Sword of Destiny';
        this.longDesc = 'The sword of 1000 truths and the sword of destiny... all rolled into one!';
        this.setWeight(2, UOM.Pounds);
    }
}

module.exports = SwordOfDestiny;
