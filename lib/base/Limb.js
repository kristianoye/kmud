/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    GameObject = require(Base.GameObject);

class Limb extends GameObject {
    create() {
        this.setShortDescription('A limb');
    }
}

module.exports = Limb;
