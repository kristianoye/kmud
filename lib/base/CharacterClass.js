/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { ValidStats } from 'ValidStats';

export default abstract class CharacterClass extends MUDObject {
    abstract create() {
    }

    protected set channelName(chname) {
        if (typeof chname === 'string')
            set(chname);
    }

    get channelName() {
        return get(false);
    }

    protected set className(name) {
        if (typeof name === 'string')
            set(name);
    }

    get className() {
        return get('');
    }

    protected set enabled(flag) {
        if (typeof flag === 'boolean')
            set(flag);
    }

    get enabled() {
        return get(true);
    }

    protected set minStats(stats) {
        if (typeof stats === 'object') {
            let reqs = {};
            for (const [stat, level] of Object.entries(stats)) {
                if (ValidStats.indexOf(stat) > -1 && level > 0) {
                    reqs[stat] = level;
                }
            }
            set(reqs);
        }
    }

    get minStats() {
        return get({});
    }

    /**
     * Set the channel name characters of this class may use to communicate on
     * @param {string} ch The name of the chat channel
     * @returns
     */
    protected setChannelName(ch) {
        this.channelName = ch;
        return this;
    }

    /**
     * Set the class name; This must be unique
     * @param {string} s The name of the class
     * @returns
     */
    protected setClassName(s) {
        this.className = s;
        return this;
    }

    /**
     * Set whether the class is currently available for play
     * @param {boolean} flag Class is playable if set to true
     * @returns
     */
    protected setEnabled(flag) {
        this.enabled = flag;
        return this;
    }

    /**
     * Set whether the class is currently available for play
     * @param {Object.<string,number>} stats The minimum stat requirements
     * @returns
     */
    protected setMinStats(stats) {
        this.minStats = stats;
        return this;
    }
}
