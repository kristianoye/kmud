
const
    Container = require('./Container'),
    _validGenders = [
        'female',
        'male',
        'neutar'
    ];

var
    BodyDaemon = efuns.loadObject('/daemon/BodyDaemon');

class Body extends Container {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.prop({
            bodyLimbs: {},
            bodyType: 'human'
        }));
    }
    addHP(hp, limb) {
        if (typeof limb === 'string' || true) {
            var limb = this.getLimb(limb);
            if ((limb.curHP += hp) < 0) {
                if (typeof this.writeLine === 'function')
                    this.writeLine('Your ' + limb + ' has been completely destroyed!');
                var limb = efuns.cloneObject('/base/Limb');
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
        ], inv = efuns.consolidateArray(this.inventory);
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
