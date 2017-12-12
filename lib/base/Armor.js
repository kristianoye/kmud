include('Base');

imports(LIB_OBJECT);

class Armor extends GameObject {
    /**
     *
     * @param {MUDCreationContext} ctx
     */
    constructor(ctx) {
        super(ctx.prop({
            layer: 0,
            limbs: [],
            rating: 0
        }));
    }
}

MUD.export(Armor);
