imports('GameObject');

class Limb extends GameObject {
    create() {
        this.setShortDescription('A limb');
    }
}

MUD.export(Limb);
