/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { DIR_RACES } from '@Dirs';
import { FILE_RACES } from '@DataFiles';
import { LIB_RACE } from '@Base';


/**
 * @typedef {Object} PlayerRace
 * @property {string} name
 * @property {string} bodyType
 * @property {boolean} playable
 */

export default singleton class RaceDaemon {
    protected async create() {
        await this.loadRaces();
    }

    private set loadedRaces(spec) {
        if (typeof spec === 'object')
            set(spec);
    }

    /**
     * @returns {Object.<string,PlayerRace>}
     */
    private get loadedRaces() {
        return get({});
    }

    //#region Methods

    /**
     * Get a list of player-usable races
     * @returns {string[]}
     */
    getPlayerRaces() {
        let races = this.loadedRaces;
        return Object.keys(races)
            .map(r => races[r])
            .filter(r => r.playable === true)
            .map(r => r.name);
    }

    getRaceHelp(race) {
        let result = `About the ${race} race:\n`,
            data = this.loadedRaces[race];

        if (!race)
            return `The ${race} race does not appear to exist in this realm`;

        result += (data.description || 'No description available');

        return result;
    }

    /**
     * Load class types
     */
    private async loadRaces() {
        let raceFile = await efuns.fs.getObjectAsync(FILE_RACES),
            /** @type {PlayerRace[]} */
            raceData = raceFile.exists && await raceFile.readYamlAsync(),
            defaultData,
            races = {};

        if (!Array.isArray(raceData))
            throw new Error(`Unable to load race data from ${FILE_RACES}`);

        let defaultIndex = raceData.findIndex(r => r.name === 'DEFAULTS');

        if (defaultIndex < 0)
            throw new Error(`Unable to load race data from ${FILE_RACES}; Could not find DEFAULTS`);
        else {
            defaultData = raceData[defaultIndex];
            raceData.splice(defaultIndex, 1);
        }

        for (const race of raceData) {
            let newRace = Object.assign({}, defaultData);
            for (const [key, value] of Object.entries(race)) {
                switch (key) {
                    case 'languages':
                        newRace.languages = Object.assign({}, newRace.languages, value);
                        break;

                    case 'stats':
                        for (const [stat, data] of Object.entries(race.stats)) {
                            newRace.stats[stat] = Object.assign({}, newRace.stats[stat], data);
                        }
                        break;

                    default:
                        newRace[key] = race[key];
                        break;
                }
            }
            races[newRace.name] = newRace;
        }
        this.loadedRaces = races;
    }

    //#endregion
}