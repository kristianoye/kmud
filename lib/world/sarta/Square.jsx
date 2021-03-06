﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Room = await requireAsync(Base.Room);

function formatName() {
    let tp = this_player();
    if (tp)
        return tp.name;

    return '';
}

/**
 * The base room of the example domain.
 */
class Square extends Room {
    private create() {
        this.keyId = 'Square';
        this.shortDesc = 'The Central Square of Sarta';
        this.longDesc = <div>
            <p>Hello, {formatName()}</p>
            <p>This is the heart of the main city in Sarta.  There are many tall buildings
            surrounding the square and hundreds of people mill about the street conducting
                business.</p>
            <p>To the south is the city port of entry for the large ships that dock here
                every day to supply the city with food and other vital supplies.</p>
        </div>;
        this.addExit('fighter', 'classHalls/Fighter');
        this.addExit('out', '/realms/kriton/Workroom');
        this.addExit('north', 'streets/northMain01');
        this.addExit('south', 'streets/southmain01');
    }

    async resetAsync() {
        if (!efuns.present('harry')) {
            let harry = await efuns.cloneObjectAsync('mob/Harry');
            await harry().moveObjectAsync(this);
        }
    }
}

module.exports = await createAsync(Square);
