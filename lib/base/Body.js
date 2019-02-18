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
                gender: data && data.gender || 'neutar',
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
        get(PROP_TYPE, 'human');
    }

    set bodyType(bodyType) {
        // TODO: Add call to body daemon to fetch limb data
        set(PROP_TYPE, bodyType);

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


    get displayName() {
        let display = get(PROP_DISPLAYNAME, this.keyId || '');
        if (efuns.normalizeName(display) !== super.keyId) {
            return this.name || 'body';
        }
        return display;
    }

    set displayName(value) {
        if (efuns.normalizeName(value) === super.keyId) {
            set(PROP_DISPLAYNAME, value);
        }
    }

    get gender() {
        return get(PROP_GENDER, 'neutar');
    }

    set gender(gender) {
        if (typeof gender === 'string' && ValidGenders.indexOf(gender) > -1) {
            set(PROP_GENDER, gender);
        }
    }

    get health() {
        return get(PROP_HP, 1);
    }

    set health(value) {
        if (typeof value === 'number') {
            set(PROP_HP, value);
        }
    }

    get healthMax() {
        return get(PROP_HPMAX, 1);
    }

    set healthMax(value) {
        if (typeof value === 'number' && value > 0) {
            set(PROP_HPMAX, value);
        }
    }

    get limbs() {
        return get(PROP_LIMBS, []);
    }

    /**
        * Returns the being's race.
        * @type {string}
        */
    get race() {
        return get(PROP_RACE, 'human');
    }

    set race(value) {
        if (typeof value === 'string' && value.length > 0) {
            set(PROP_RACE, value);
        }
    }

    getLimb(limb) {
        var body = this.getProperty('bodyLimbs', {});
        return body[limb];
    }
}

module.exports = Body;
