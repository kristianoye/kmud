
declare class Room extends Container {
    /**
        * Add an exit to the room.
        * @param dir The direction in which to go.
        * @param dest The relative path to the next room.
        * @returns {Room}
        */
    addExit(dir: string, dest: string): Room;
    addExit(dir: string, dest: string, hidden: boolean): Room;
    addExit(dir: string, dest: function): Room;
}

/// <reference path="GameObject.d.ts"/>
/// <reference path="Container.d.ts"/>