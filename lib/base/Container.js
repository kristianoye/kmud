/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import GameObject from "./GameObject";

export default class Container extends GameObject {
    override canAcceptItem(item) {
        if (!item)
            return false;
        else if (item.instance instanceof GameObject === false)
            return false;
        else if (efuns.living.isAlive(item))
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

    override isInventoryAccessible() { return true; }

    override isInventoryVisible() { return true; }

    get itemMultiplier() {
        return get(1.0);
    }

    set itemMultiplier(value) {
        if (typeof value === 'number') set(value);
    }

    /**
     * @returns {number} The amount of weight associated with the container and its contents.
     */
    override get weight() {
        let ret = super.weight;
        this.inventory.forEach(i => {
            ret += this.getItemWeight(i);
        });
        return ret;
    }
}
