/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    GameObject = require('./GameObject');

class Container extends GameObject {
    canAcceptItem(item) {
        if (item.isLiving())
            return false;

        return true;
    }

    canReleaseItem(item) {
        return true;
    }

    /**
     * Get the weight of an item in the container inventory.  This
     * allows for specialized containers that might make certain 
     * types of items weigh less (magic).
     * @param {MUDObject|MUDWrapper} item The item to weigh.
     * @returns {number}
     */
    getItemWeight(item) {
        let weight = item.weight || 0;
        return (weight * super.itemMultiplier);
    }

    indirectGetObjectFromObject(target, container) {
        return target.environment === this;
    }

    indirectPutObjectInObject(target, container) {
        return target.environment !== this;
    }

    indirectLookAtObjectInObject(target, container) { return true; }

    isInventoryAccessible() { return true; }

    isInventoryVisible() { return true; }

    get itemMultiplier() {
        return get(1.0);
    }

    set itemMultiplier(value) {
        if (typeof value === 'number') set(value);
    }

    /**
     * @returns {number} The amount of weight associated with the container and its contents.
     */
    get weight() {
        let ret = super.weight;
        this.inventory.forEach(i => {
            ret += this.getItemWeight(i);
        });
        return ret;
    }
}

module.exports = Container;

