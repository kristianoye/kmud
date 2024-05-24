/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { DIR_RACES } from '@Dirs';
import { LIB_RACE } from '@Base';
import CharacterRace from LIB_RACE;

export default singleton class RaceDaemon {
    protected async create() {
        await this.loadRaces();
    }

    private set loadedRaces(spec) {
        if (typeof spec === 'object')
            set(spec);
    }

    private get loadedRaces() {
        return get({});
    }

    /**
     * Load class types
     */
    private async loadRaces() {
        let raceDir = await efuns.fs.getObjectAsync(DIR_RACES),
            files = raceDir && await raceDir.readDirectoryAsync(),
            newRaces = {};

        if (files) {
            for (const file of files) {
                if (file.isLoadable) {
                    let raceObject = await file.loadObjectAsync(),
                        inst = raceObject && raceObject.instance;

                    if (inst && inst instanceof CharacterRace) {
                        files[inst.className] = raceObject;
                    }
                }
            }
            this.loadedRaces = files;
        }
    }
}