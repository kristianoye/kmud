/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
class ItemSupportBase extends MUDMixin {
    directDropObject() {
        if (this.environment !== thisPlayer)
            return 'You do not have the ' + this.displayName + ' to drop';
        return true;
    }

    directGetObject() {
        if (this.environment === thisPlayer)
            return 'You already have the ' + this.displayName + '!';
        return true;
    }

    directGetObjectFromObject(target, container) {
        return this.environment === container;
}

    directLookAtObject(target) {
        return true;
}

    directLookAtObjectInObject(target, container) {
        return true;
}

    directPutObjectInObject(target, container) {
        return (this.environment !== container);
    }
}

module.exports = ItemSupportBase;
