/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_ROOM } from '@Base';
import Room from LIB_ROOM;

function formatName() {
    let tp = this_player();
    if (tp)
        return tp.name;

    return 'unknown';
}

/**
 * The base room of the example domain.
 */
export default final singleton class Square extends Room {
    private override create() {
        super->Room::create();
        this.keyId = 'Square';
        this.shortDesc = 'The Central Square of Sarta';
        this.addExit('fighter', 'classHalls/Fighter');
        this.addExit('out', '/realms/kriton/Workroom');
        this.addExit('north', 'streets/northMain01');
        this.addExit('south', 'streets/southmain01');
        this
            .addItem('default', {
                smell: 'It smells like horse dung.',
                listen: 'You hear the bustle of shoppers, merchants, and horses.'
            })
            .addItem('buildings', {
                description: 'There are buildings of all different sizes, shape, and height'
            });
    }

    override get longDesc() {
        return <div>
            <p>Hello, {formatName()}</p>
            <p>This is the heart of the city of Sarta.  There are many tall buildings
                surrounding the square and hundreds of people mill about the street conducting
                business.</p>
            <p>To the south is the city port of entry for the large ships that dock here
                every day to supply the city with food and other vital supplies.</p>
        </div>;
    }

    async resetAsync() {
        if (!efuns.present('harry')) {
            let harry = await efuns.cloneObjectAsync('mob/Harry');
            await harry.instance.moveObjectAsync(this);
        }
    }
}
