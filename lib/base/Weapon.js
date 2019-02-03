const
    Base = require('Base'),
    GameObject = require(Base.GameObject);

class Weapon extends GameObject {
    constructor(ctx) {
        super();
        this.setProperty({
            weaponType: 'club'
        });
    }

    get weaponType() {
        return this.getProperty('weaponType', 'club');
    }

    setWeaponType(type) {
        return this.setProperty('weaponType', type);
    }
}

module.exports = Weapon;

