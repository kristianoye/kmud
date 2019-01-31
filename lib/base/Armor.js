/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    GameObject = require(Base.Object);

class Armor extends GameObject {
    /**
     *
     * @param {MUDCreationContext} ctx
     */
    constructor(ctx) {
        super(ctx.prop({
            layer: 0,
            limbs: [],
            rating: 0
        }));
    }
}

module.exports = Armor;

