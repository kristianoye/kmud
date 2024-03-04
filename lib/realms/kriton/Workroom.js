import { LIB_ROOM } from 'Base';
import Room from LIB_ROOM;

export default singleton class Workroom extends Room {
    override create() {
        this.setShort("Kriton's Workroom")
        this.setLong("This is going to take some time to finish")
        this.addExit('out', '/world/sarta/square');
    }

    async initAsync() {
        efuns.addAction('lock', (str, words) => {
            if (!str)
                return 'Lock what?';
        });
    }
}
