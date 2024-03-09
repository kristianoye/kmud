/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_ROOM } from 'Base';
import Room from LIB_ROOM;

export default singleton class FighterHall extends Room {
    private override create() {
        this.shortDesc = 'Fighter Initiation Hall';
        this.longDesc = <div>
            This room is reserved for those who wish to join the ranks of the FIGHTERS. 
            Fighters are elite warriors who are well-versed in weapon-based combat.  In 
            order to join you must <strong>become a fighter</strong>.
        </div>;
        this.setExits({
            "out":"../Square"
        });
    }

    async initAsync() {
        efuns.addAction('become', this.becomeFighter);
    }

    async becomeFighter(str, evt) {
        let result = false;
        if (!str)
            return 'Become a what?';
        else if (str != 'fighter')
            return 'You can only become a fighter here';
        else
            return writeLine('You become a fighter!');
    }
}
