const
    GameObject = require('./GameObject'),
    ValidWeaponTypes = [
        'long sword',
        'short sword',
        'dagger',
        'knife',
        'club',
        'staff',
        'axe',
        'hand axe',
        'throwing axe',
        'throwing knife',
        'throwing star',
        'two-handed sword',
        'whip',
        'hammer',
        'spear',
        'scythe',
        'bow',
        'crossbow'
    ];

class Weapon extends GameObject {
    get weaponType() {
        return get('club');
    }

    setWeaponType(value) {
        if (ValidWeaponTypes.indexOf(value) > -1)
            set(value);
    }
}

module.exports = Weapon;

