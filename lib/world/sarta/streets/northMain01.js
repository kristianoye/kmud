/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 27, 2019
 */
const
    Base = require('Base'),
    Room = require(Base.Room);

/**
 * The base room of the example domain.
 */
class NorthMain01 extends Room {
    private create() {
        this.keyId = 'North Main';
        this.shortDesc = 'North Main Street in Sarta';
        this.longDesc = `The long road that is North Main sprawls out before you.  It has two well-worn sets of wagon ruts that delimit the two sides of the road`;
        this.addExit('south', '../Square');
    }
}

module.exports = new NorthMain01();
