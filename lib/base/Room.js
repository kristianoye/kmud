/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Container = require(Base.Container);

class Room extends Container {
    protected constructor() {
        super();

        this.setProperty({
            exits: {},
            light: 0,
            elevation: 0,
            indoors: false
        });
    }

    /**
     * Add an exit to the room
     * 
     * @param {string} dir The direction in which to travel.
     * @param {string} dest The destination if the player moves in this direction.
     * @param {boolean} hidden Is the exit hidden?
     * @returns {Room} Reference to self.
     */
    addExit(dir, dest, hidden) {
        let exits = this.getProperty('exits', {});
        exits[dir] = {
            destination: typeof dest === 'string' ? efuns.resolvePath(dest) : dest,
            hidden: hidden === true
        };
        return this;
    }

    canAcceptItem(item) {
        return true;
    }

    getExit(dir) {
        let exits = this.getProperty('exits'), exit = exits[dir] || false;
        if (exit) {
            let dest = exit.destination;
            if (typeof dest === 'function')
                dest = dest.call(this, thisPlayer);
            return dest;
        }
        return false;
    }

    get indoors() {
        return this.getProperty('indoors', false) === true;
    }

    get light() {
        return parseInt(this.getProperty('light', 0)) || 0;
    }

    hasExit(dir) {
        let exits = this.getProperty('exits', {});
        return typeof dir === 'string' && dir in exits;
    }

    onGetContentDescription(perspective) {
        let items = this.inventory
            .map(i => unwrap(i))
            .filter(i => i !== perspective),
            shorts = [], sc = 0,
            livings = [], lc = 0,
            players = [],
            result = [];

        for (var i = 0, max = items.length; i < max; i++) {
            var s = items[i].shortDescription,
                w = efuns.isLiving(items[i]) ? livings : shorts;
            if (efuns.playerp(items[i]))
                players.push(items[i].getTitle());
            else if (efuns.isLiving(items[i]))
                livings.push(items[i].shortDescription), lc++;
            else
                shorts.push(items[i].shortDescription), sc++;
        }
        if (shorts.length > 0) result.push(efuns.arrayToSentence(shorts).ucfirst() + (sc > 1 ? " are here." : " is here."));
        if (livings.length > 0) result.push(efuns.arrayToSentence(livings).ucfirst() + (lc > 1 ? " are here." : " is here."));
        if (players.length > 0) result.push(...players);
        return result.join('\n');
    }

    onGetDescription(perspective) {
        if (perspective.environment === this) {
            var result = [];
            if (efuns.wizardp(perspective)) {
                result.push(this.filename);
            }
            result.push(this.title || 'Some Unknown Location');
            result.push(this.description || 'Some nondescript location without so much as a single, notable feature');
            let exits = this.onGetObviousExits(perspective);
            if (exits) result.push(this.onGetObviousExits(perspective));
            result.push(this.onGetContentDescription(perspective));
            return result.join('\n');
        }
    }

    onGetObviousExits(perspective) {
        let exits = this.getProperty('exits', []);
        let result = [];
        let text = '';

        for (let dir in exits) {
            let exit = exits[dir];
            if (exit.hidden) continue;
            result.push(dir);
        }

        if (result.length === 0)
            text = "There are no obvious exits.";
        else
            text = `There ${(result.length > 1 ? "are" : "is")} ${efuns.cardinal(result.length)} obvious ${(result.length > 1 ? "exits" : "exit")}: `;

        if (result.length === 1)
            text += result[0];
        else if (result.length === 2)
            text += result[0] + ' and ' + result[1];
        else if (result.length > 2)
            text += result.slice(0, result.length - 1).join(', ')
                + ' and ' + result[result.length - 1];

        return '%^GREEN%^' + text + '%^RESET%^';
    }

    setLight(level) {
        return this.setProperty('light', level);
    }
}

module.addMixin(Room, 'Partials/Senses');

module.exports = Room;
