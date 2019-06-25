const
    Base = require('Base'),
    Room = require(Base.Room);

class Workroom extends Room {
    create() {
        this.setShort("Wizard's Workroom")
        this.setLong("This is a very basic, non-descript wizard workroom.")
        this.addExit('out', '/world/sarta/square');
    }
}

module.exports = new Workroom();
