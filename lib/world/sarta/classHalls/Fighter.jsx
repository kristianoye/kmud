/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Room = await requireAsync(Base.Room);

class FighterHall extends Room {
    private create() {
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
            result = efuns.errorLine('Become a what?');
        else
            result = efuns.writeLine("You become a fighter");
        return result;
    }
}

module.exports = await createAsync(FighterHall);
