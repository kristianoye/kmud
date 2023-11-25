/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

abstract class Get {
    directGetObject() {
        if (this.environment === thisPlayer)
            return 'You already have the ' + this.shortDesc + '!';
        return true;
    }

    directGetObjectFromObject(target, container) {
        return this.environment === container;
    }
}

module.exports = Get;