/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Container = require(Base.Container),
    _validGenders = [
        'female',
        'male',
        'neutar'
    ];

const
    BodyDaemon = efuns.loadObjectSync(Daemon.Body);

class Body extends Container {
    constructor() {
        super();
        this.setProperty({
            bodyLimbs: {},
            bodyType: 'human'
        });
    }
    addHP(hp, limbName) {
        if (typeof limbName === 'string') {
            let limb = this.getLimb(limbName);
            if ((limb.curHP += hp) < 0) {
                if (typeof this.writeLine === 'function')
                    this.writeLine('Your ' + limb + ' has been completely destroyed!');
                var limbObj = efuns.cloneObject('/base/Limb');
            }
            else if (limb.curHP > limb.maxHP) {
                limb.curHP = limb.maxHP;
            }
        }
        return this;
    }

    addLimb(name, HP, maxHP, isFatal, digits) {
        var body = this.getProperty('bodyLimbs', {}),
            limb = typeof name === 'object' ? name : {
                curHP: maxHP || HP || 50,
                fatal: isFatal || false,
                maxHP: maxHP || HP || 50,
                severed: false
            };

        if (typeof digits === 'number' && digits > 0 && digits < 7) {
            limb.digits = digits;
        }
        if (typeof name === 'string') {
            if (!body[name]) {
                body[name] = limb;
            }
        }
        return this;
    }

    get bodyType() { return this.getProperty('bodyType', 'human'); }

    /**
        * Returns the being's race.
        * @type {string}
        */
    get race() {
        return this.getProperty('race', 'human');
    }

    get hitPoints() { return this.getProperty('curHP', 0); }

    get maxHitPoints() { return this.getProperty('maxHP', 1); }

    get limbs() {
        var body = this.getProperty('bodyLimbs', {}), list = Object.keys(body);
        return list;
    }

    get gender() {
        return this.getProperty('gender', 'male');
    }

    getLimb(limb) {
        var body = this.getProperty('bodyLimbs', {});
        return body[limb];
    }

    get longDescription() {
        var result = [
            `${this.displayName} is a ${this.gender} ${this.race}`,
            super.longDescription
        ], inv = efuns.array.consolidateArray(this.inventory);
        if (inv.length > 0) {
            result.push(this.displayName + ' is carrying:');
            result.push(...inv);
        }
        return result.join('\n');
    }

    setBodyType(bodyType) {
        var body = BodyDaemon().getBody(bodyType);
        var curBody = this.getProperty('bodyLimbs', {});

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
        return this;
    }

    setGender(gender) {
        if (_validGenders.indexOf(gender) > -1)
            this.setProperty('gender', gender);
        return this;
    }

    setRace(race) {
        this.setBodyType(race);
        this.setProperty('race', race);
        return this;
    }
}

module.exports = Body;
