/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

class Senses extends MUDMixin {
    getItem(item) {
        let items = this.getProperty('senses', {});
        if (item in items) {
            return items[item];
        }
        return false;
    }
}

module.exports = Senses;
