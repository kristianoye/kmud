const
    Base = await requireAsync('Base'),
    Room = await requireAsync(Base.Room);

class Workroom extends Room {
    create() {
        this.setShort("Kriton's Workroom")
        this.setLong("This is going to take some time to finish")
        this.addExit('out', '/world/sarta/square');
    }

    init() {
        efuns.addAction('lock', (str, words) => {
            if (!str)
                return 'Lock what?';
        });
    }
}

module.exports = new Workroom();
