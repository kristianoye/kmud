import { LIB_ROOM } from '@Base';
import { Room } from LIB_ROOM;

class Workroom extends Room {
    create() {
        this.setShort("Wizard's Workroom")
        this.setLong("This is a very basic, non-descript wizard workroom.")
        this.addExit('out', '/world/sarta/square');
    }
}

module.exports = await createAsync(Workroom);
