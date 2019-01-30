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
    create() {
        with (this) {
            setShort('The Central Square of Sarta')
            setLong(<p>This is the heart of the main city in Sarta.  There are many tall buildings
                surrounding the square and hundreds of people mill about the street conducting
                business.</p>)
            addExit('out', '/realms/kriton/Workroom')
            addExit('north', './northMain1')
            addExit('south', './southmain1');
        }
    }

    reset() {
        if (!efuns.present('harry')) {
            let harry = efuns.cloneObject('./mob/Harry');
            unwrap.call(this, harry, o => {
                o.moveObject(this);
            });
        }
    }
}

module.exports = new Square();
