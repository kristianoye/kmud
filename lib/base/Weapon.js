import GameObject from './GameObject';

const
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

export default class Weapon extends GameObject {
    get weaponType() {
        return get('club');
    }

    protected set weaponType(str) {
        if (ValidWeaponTypes.indexOf(value) > -1)
            set(value);
    }

    setWeaponType(value) {
        this.weaponType = value;
        return this;
    }
}
