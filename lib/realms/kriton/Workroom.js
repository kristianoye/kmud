const
    Base = require('Base'),
    Room = require(Base.Room);

class Workroom extends Room {
    create() {
        with (this) {
            setShort("Kriton's Workroom")
            setLong("This is going to take some time to finish")
            addExit('out', '/world/sarta/square');
        }
    }

    init() {
    }
}

module.exports = new Workroom();
