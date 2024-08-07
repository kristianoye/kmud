﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Container from './Container';
import { BODY_D } from '@Daemon';

const
    ValidGenders = [
        'female',
        'male',
        'neutar',
        'other'
    ];

const
    BodyDaemon = await efuns.loadObjectAsync(BODY_D);

export default class Body extends Container {
    override create() {
        super.create();
        if (!this.bodyType) this.bodyType = 'human';
        if (!this.race) this.race = 'human';
    }


    /**
     * Returns the body type
     * @type {string}
     */
    get bodyType() {
        return get('human');
    }
    set bodyType(value) {
        // TODO: Add call to body daemon to fetch limb data
        if (typeof value === 'string' && value.length > 0) {
            set(value);

            let body = BodyDaemon().getBody(value);
            let curBody = this.limbs || {};

            Object.keys(curBody).forEach(function (n, i) {
                delete curBody[n];
            });

            Object.keys(body).forEach(function (n, i) {
                curBody[n] = {
                    curHP: body[n].factor * 100,
                    fatal: false,
                    maxHP: body[n].factor * 100,
                    severed: false
                };
            });
        }
    }

    override get longDesc() {
        let baseDesc = super.longDesc;

        let result = [`${this.displayName} is a ${this.gender} ${this.race}`, baseDesc],
            inv = efuns.arrays.consolidate(this.inventory);

        if (inv.length > 0) {
            result.push(this.displayName + ' is carrying:');
            result.push(...inv);
        }
        return result.join('\n');
    }

    override set longDesc(s) {
        super.longDesc = s;
    }

    get displayName() {
        let display = get(this.keyId);
        if (efuns.normalizeName(display) !== super.keyId) {
            return this.name || 'body';
        }
        return display;
    }

    set displayName(value) {
        if (efuns.normalizeName(value) === super.keyId) set(value);
    }

    get gender() {
        return get('neutar');
    }

    set gender(value) {
        if (typeof value === 'string' && ValidGenders.indexOf(value) > -1) set(value);
    }

    get hp() {
        return get(50);
    }

    set hp(value) {
        if (typeof value === 'number') {
            //  TODO: Is health < 0?  Die?
            set(value);
        }
    }

    get maxHp() {
        return get(50);
    }

    set maxHp(value) {
        if (typeof value === 'number' && value > 0) set(value);
    }

    get limbs() {
        return get({});
    }

    get race() {
        return get('human');
    }

    set race(value) {
        if (typeof value === 'string' && value.length > 0) set(value);
    }

    getLimb(limb) {
        let body = this.limbs;
        return body[limb];
    }
}
