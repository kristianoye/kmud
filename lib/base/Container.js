/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    GameObject = require(Base.GameObject);

class Container extends GameObject {
    constructor(data) {
        super(data);

        register({
            container: {
                contentMultiplier: 1.0,
                maxCapacity: -1
            }
        })
    }

    canAcceptItem(item) {
        if (item.isLiving())
            return false;
        return true;
    }

    canReleaseItem(item) { return true; }

    indirectGetObjectFromObject(target, container) {
        return target.environment === this;
    }

    indirectPutObjectInObject(target, container) {
        return target.environment !== this;
    }

    indirectLookAtObjectInObject(target, container) { return true; }

    isInventoryAccessible() { return true; }

    isInventoryVisible() { return true; }

    /**
        * @returns {number} The amount of weight associated with the container and its contents.
        */
    getWeight() {
        var w = super.getWeight();
        var c = this.inventory;
        for (var i = 0; i < c.length; i++) {
            w += c[i].getWeight();
        }
        return w;
    }
}

module.exports = Container;

