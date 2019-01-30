/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
function getUnitWeight(units) {
    var multiplier = 1;

    if (!units)
        return 0;

    switch (units.toLowerCase()) {
        case 'kg': case 'kilogram': case 'kgs': case 'kilograms':
            multiplier = 1000;
            break;

        case 'mg': case 'mgs':
            multiplier = 1 / 1000;
            break;

        case 'ounce': case 'ounces': case 'oz':
            multiplier = 28.3495;
            break;

        case 'pound': case 'pounds': case 'lb': case 'lbs':
            multiplier = 453.592;
            break;

        case 'stone': case 'stones':
            multiplier = 6350.28800006585;
            break;

        case 'ton': case 'tons':
            multiplier = 907184.000009408;
            break;
    }
    return multiplier;
}

class GameObject extends MUDObject {
    /**
     * @param {MUDCreationContext} ctx
    */
    constructor(ctx) {
        super(ctx.prop({
            items: {},
            shortDescription: '',
            longDescription: ''
        }));
    }

    addItem(name, prop) {
        return this;
    }

    getSharedProperty(key, defaultValue) {
        return super.getSharedProperty(key, defaultValue);
    }

    getAdjectives() {
        return this.getProperty('adjectives', []);
    }

    get displayName() {
        return this.getFirst('invisName', 'displayName', 'name', 'briefDescription');
    }

    setDisplayName(name) {
        if (efuns.normalizeName(name) === this.getPrimaryName()) {
            return super.setProperty('displayName', name);
        }
    }

    getFirst(prop) {
        var a = [].slice.call(arguments);
        for (var i = 0; i < a.length; i++) {
            var p = this.getProperty(a[i]);
            if (p) {
                if (typeof p === 'function') p = p.call(this, a[i]);
                if (p) return p;
            }
        }
        return undefined;
    }

    get longDescription() {
        return this.getFirst('longDescription', 'shortDescription', 'name').trim();
    }

    getPluralizedName() { return this.getProperty('pluralizedName', ''); }

    get primaryName() { return this.getProperty('name', ''); }

    getPrimaryName() { return this.getProperty('name', ''); }

    get weight() { return this.getProperty('weight', 0); } 

    getWeight(units) {
        var d = getUnitWeight(units || 'pounds'),
            w = this.getProperty('weight', 0);
        return w > 0 && d > 0 ? (w / d) : 0;
    }

    get shortDescription() {
        return this.getFirst('shortDescription', 'name');
    }

    isInventoryAccessible() { return false; }

    isInventoryVisible() { return false; }

    setLong(s) {
        return this.setProperty('longDescription', s);
    }

    setPrimaryName(name) {
        if (typeof name !== 'string' || name.length === 0)
            throw new Error('Bad argument 1 to setPrimaryName; Must be non-blank string.');
        if (/\s+/.test(name))
            throw new Error('Bad argument 1 to setPrimaryName; Name should not include spaces.');
        var ids = this.getProperty('idList', []);
        name.toLowerCase().replace(/[^a-z]+/g, '');
        if (ids.indexOf(name) < 0)
            ids.unshift(name);
        return this.setProperty('name', name);
    }

    setProperty(key, value) {
        return super.setProperty(key, value);
    }

    setSharedProperty(key, value) {
        return super.setSharedProperty(key, value);
    }

    setShort(s) {
        return this.setProperty('shortDescription', s, 'string|function'), this;
    }

    setWeight(n, units) {
        var multiplier = 1;

        if (typeof units === 'undefined')
            units = 'grams';
        else if (typeof units !== 'string')
            throw new Error(`Bad parameter 1 to setWeight; Expected string got ${typeof units}`);

        multiplier = getUnitWeight(units.toLowerCase());
        return this.setProperty('weight', n * multiplier), this;
    }

    tellEnvironment(msg, includeSelf) {
        var env = this.environment, self = this;
        msg = msg.replace('$N', this.displayName);
        if (env) {
            env.inventory.forEach((i, n) => {
                if (i === this && includeSelf !== true) return;
                typeof i.writeLine === 'function' && i.writeLine(msg);
            });
        }
    }
}

module.addMixin(GameObject, 'Verbs/ItemSupportBase');

module.exports = GameObject;
