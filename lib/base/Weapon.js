imports('GameObject');

class Weapon extends GameObject {
    /**
        * Initialize the weapon 
        * @param {MUDCreationContext} ctx The constructor context
        */
    constructor(ctx) {
        super(ctx.prop('weaponType', 'weapon'))
    }

    get weaponType() {
        return this.getProperty('weaponType', 'weapon');
    }

    setWeaponType(type) {
        return this.setProperty('weaponType', type);
    }
}

MUD.export(Weapon);
