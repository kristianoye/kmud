/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { BODY_D } from '@Daemon';
import { ValidStats } from '@ValidStats';

const
    STAT_MINIMUM = 5,
    STAT_INITIAL = 10,
    STAT_MAXIMUM = 18,
    BodyDaemon = await efuns.loadObjectAsync(BODY_D);

export default abstract class CharacterRace extends SimpleObject {
    //#region Properties

    protected set bodyType(bodyType) {
        if (typeof bodyType === 'string') {
            set(bodyType);
        }
    }

    get bodyType() {
        return get('human');
    }

    protected set healthModifier(mod) {
        if (typeof mod === 'number' && mod > 0)
            set(mod);
    }

    get healthModifier() {
        return get(1.0);
    }

    private set initialStats(stats) {
        if (typeof stats === 'object') {
            let finalStats = {};
            for (const [name, info] of Object.entries(stats)) {
                if (ValidStats.indexOf(name) > -1 && typeof info === 'object') {
                    let { initial, max, min } = info;

                    if (initial > 0 && max > 0 && min > 0)
                        finalStats[name] = info;
                }
            }
            set(finalStats);
        }
    }

    get initialStats() {
        let result = get(false);
        if (!result) {
            result = {};
            for (const stat of ValidStats) {
                result[stat] = { initial: STAT_INITIAL, max: STAT_MAXIMUM, min: STAT_MINIMUM };
            }
            this.initialStats = result;
        }
        return result;
    }

    protected set isPlayerRace(flag) {
        if (typeof flag === 'boolean') {
            set(flag);
        }
    }

    /**
     * Can players select this race?
     * @returns {boolean}
     */
    get isPlayerRace() {
        return get(false);
    }

    protected set raceName(s) {
        if (typeof s === 'string') {
            set(s);
        }
    }

    get raceName() {
        return get('');
    }

    /**
     * Set the points a player may allocate during creation
     * @param {number} points
     */
    protected set statPoints(points) {
        if (typeof points === 'number' && points > 0)
            set(points);
    }

    get statPoints() {
        return get(10);
    }

    //#endregion

    //#region Methods

    /**
     * Configure a racial stat
     * @param {string} name
     * @param {number} initial
     * @param {number} max
     * @param {number} min
     * @returns
     */
    protected addStat(name, initial = STAT_INITIAL, max = STAT_MAXIMUM, min = STAT_MINIMUM) {
        if (ValidStats.indexOf(name) > -1) {
            let stats = this.initialStats;
            stats[name] = { initial, min, max };
            this.initialStats = stats;
        }
        return this;
    }

    /**
     * Indicate whether players can use this race
     * @param {boolean} flag Players may select this as their race if true
     * @returns
     */
    protected enablePlayerRace(flag) {
        this.isPlayerRace = flag;
        return this;
    }

    /**
     * Set the body type
     * @param {string} bodyType
     */
    protected async setBodyType(bodyType = 'human') {
        let body = await BodyDaemon.instance.getBody(bodyType);
        if (body === false) {
            throw new Error(`Body type ${bodyType} is not valid`);
        }
        else {
            this.bodyType = bodyType;
        }
        return this;
    }

    /**
     * Some races are physically tougher or weaker than the human baseline of 1.
     * @param {numbery} n The multiplier for base health
     * @returns
     */
    protected setHealthModifier(n) {
        this.healthModifier = n;
        return this;
    }

    /**
     * Set the name of the class
     * @param {string} name
     * @returns
     */
    protected setRaceName(name) {
        this.raceName = name;
        return this;
    }

    /**
     * Indicates how many points a player gets to allocate during creation
     * @param {number} points
     * @returns
     */
    protected setStatPoints(points) {
        this.statPoints = points;
        return this;
    }

    //#endregion
}