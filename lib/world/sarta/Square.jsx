/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Room = require(Base.Room);

/**
 * The base room of the example domain.
 */
class Square extends Room {
    private create() {
        this.keyId = 'Square';
        this.shortDesc = 'The Central Square of Sarta';
        this.longDesc = <div>
            <p>This is the heart of the main city in Sarta.  There are many tall buildings
            surrounding the square and hundreds of people mill about the street conducting
                business.</p>

            <p>To the south is the city port of entry for the large ships that dock here
                every day to supply the city with food and other vital supplies.</p>
        </div>;

        this.addExit('out', '/realms/kriton/Workroom');
        this.addExit('north', 'streets/northMain01');
        this.addExit('south', 'streets/southmain01');
    }

    reset() {
        if (!efuns.present('harry')) {
            let harry = efuns.cloneObject('mob/Harry');
            harry().moveObject(this);
        }
    }
}

module.exports = new Square();
