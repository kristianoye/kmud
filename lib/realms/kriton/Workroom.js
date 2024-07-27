import { LIB_ROOM } from '@Base';
import Room from LIB_ROOM;

var
    locked = false;

export default singleton class Workroom extends Room {
    override create() {
        this.setShort("Kriton's Workroom")
        this.setLong("This is going to take some time to finish")
        this.addExit('out', '/world/sarta/square');
    }

    async initAsync() {
        efuns.addAction('lock', (str, words) => {
            if (str !== 'room')
                return 'Lock what?';
            else if (locked)
                return 'The room is already locked';
            else {
                locked = true;
                return writeLine('You lock the room');
            }
        });
        efuns.addAction('unlock', (str, words) => {
            if (str !== 'room')
                return 'Unlock what?';
            else if (!locked)
                return 'The room is not locked';
            else {
                locked = false;
                return writeLine('You unlock the room');
            }
        });
    }
}
