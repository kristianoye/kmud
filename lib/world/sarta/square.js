
MUD.include('Base');

MUD.imports(LIB_ROOM);

/**
 * The base room of the example domain.
 */
class Square extends Room {
    create() {
        this
            .setShort('The Central Square of Sarta')
            .setLong(`
<p>This is the heart of the main city in Sarta.  There are many tall buildings
surrounding the square and hundreds of people mill about the street conducting
business.</p>`)
            .addExit('out', '/realms/kriton/Workroom')
            .addExit('north', __dirname + '/northMain1')
            .addExit('south', __dirname + '/southmain1');
    }

    reset() {
        if (!efuns.present('harry')) {
            let harry = efuns.cloneObject('./mob/Harry');
            unwrap.call(this, harry, o => {
                o.moveObject(this);
            });
        }
    }
}

MUD.export(Square);
