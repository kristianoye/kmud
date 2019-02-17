/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('Body')

const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Container = require(Base.Container),
    ValidGenders = [
        'female',
        'male',
        'neutar'
    ];

const
    BodyDaemon = efuns.loadObjectSync(Daemon.Body);

class Body extends Container {
    constructor(data) {
        super(data);

        register({
            body: {
                gender: 'neutar',
                type: 'human',
                limbs: {},
                health: {
                    current: 100,
                    max: 100,
                    regen: 1
                },
                mana: {
                    current: 100,
                    max: 100,
                    regen: 1
                },
                stamina: {
                    current: 100,
                    max: 100,
                    regen: 1
                }
            },
            race: 'human'
        });
    }

    /*********************************************************************
     *  BODY PROPERTIES
     ********************************************************************/

    /** @type {string} */
    get bodyType() {
        get(BODY_TYPE, 'human');
    }

    set bodyType(bodyType) {
        // TODO: Add call to body daemon to fetch limb data
        set(BODY_TYPE, bodyType);

        let body = BodyDaemon().getBody(bodyType);
        let curBody = this.limbs;

        Object.keys(curBody).forEach(function (n, i) {
            // TODO: Remove all equipment
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

    get description() {
        var result = [
            `${this.displayName} is a ${this.gender} ${this.race}`,
            super.description
        ], inv = efuns.array.consolidateArray(this.inventory);
        if (inv.length > 0) {
            result.push(this.displayName + ' is carrying:');
            result.push(...inv);
        }
        return result.join('\n');
    }

    get gender() {
        return get(BODY_GENDER, 'neutar');
    }

    set gender(gender) {
        if (typeof gender === 'string' && ValidGenders.indexOf(gender) > -1) {
            set(BODY_GENDER, gender);
        }
    }

    get health() {
        return get(BODY_HP, 1);
    }

    set health(value) {
        if (typeof value === 'number') {
            set(BODY_HP, value);
        }
    }

    get healthMax() {
        return get(BODY_HPMAX, 1);
    }

    set healthMax(value) {
        if (typeof value === 'number' && value > 0) {
            set(BODY_HPMAX, value);
        }
    }

    get limbs() {
        return get(BODY_LIMBS, []);
    }

    /**
        * Returns the being's race.
        * @type {string}
        */
    get race() {
        return get(OB_RACE, 'human');
    }

    set race(value) {
        if (typeof value === 'string' && value.length > 0) {
            set(OB_RACE, value);
        }
    }

    getLimb(limb) {
        var body = this.getProperty('bodyLimbs', {});
        return body[limb];
    }
}

module.exports = Body;
