MUD.include('Base').defineObject(I.NPC, NPC => {
    class Harry extends NPC {
        create() {
            this.setShortDescription('Harry the Affectionate')
                .setLongDescription('Harry the Affectionate looks quite friendly.')
                .setLevel(5);
        }
    }
    return Harry;
});