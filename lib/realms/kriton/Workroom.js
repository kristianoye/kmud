MUD.include('Base');

MUD.imports(LIB_ROOM);

class Workroom extends Room {
    create() {
        this
            .setShort("Kriton's Workroom")
            .setLong("This is going to take some time to finish")
            .addExit('out', '/world/sarta/square');
    }

    init() {
        efuns.addAction('lock', function() {
            thisPlayer.writeLine('You lock the room.');
            return true;
        });
        efuns.addAction('unlock', function() {
            thisPlayer.writeLine('You unlock the room.');
            return true;
        });
    }
}

MUD.export(Workroom);
