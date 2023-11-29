/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import GameObject from './GameObject';

export default class Limb extends GameObject {
    create() {
        this.weight = units(1, 'lb');
        this.shortDesc = 'A severed limb';
        this.longDesc = 'Eww!  It is a severed limb!';
    }
}
