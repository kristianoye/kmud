/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

abstract class Drop {
    directDropObject() {
        if (this.environment !== thisPlayer())
            return 'You do not have the ' + this.shortDesc + ' to drop';
        return true;
    }
}

module.exports = Drop;

