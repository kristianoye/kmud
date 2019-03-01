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

        register({
            room: {
                exits: {},
                light: 0,
                indoors: false,
                elevation: 0
            }
        })
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
        if (typeof dir === 'object')
            return this.setExits()

        let exits = this.exits;
        exits[dir] = {
            destination: typeof dest === 'string' ?
                efuns.resolvePath(dest, efuns.directoryName(this.filename)) : dest,
            hidden: hidden === true
        };
        return this;
    }

    canAcceptItem(item) {
        return true;
    }

    get exits() {
        return get('exits', {});
    }

    getExit(dir) {
        let exits = this.exits,
            exit = exits[dir] || false;

        if (exit) {
            let dest = exit.destination;
            if (typeof dest === 'function')
                dest = dest.call(this, thisPlayer);
            return dest;
        }
        return false;
    }

    get indoors() {
        return get('room/indoors', false) === true;
    }

    set indoors(value) {
        if (typeof value === 'boolean') {
            set('room/indoors', value);
        }
    }

    get light() {
        return parseInt(get('room/light', 0)) || 0;
    }

    set light(value) {
        if (typeof value === 'number')
            set('room/light', value);
    }

    hasExit(dir) {
        let exits = this.exits;
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
            var s = items[i].shortDesc,
                w = efuns.isLiving(items[i]) ? livings : shorts;
            if (efuns.playerp(items[i]))
                players.push(items[i].getTitle());
            else if (efuns.isLiving(items[i]))
                livings.push(items[i].shortDesc), lc++;
            else
                shorts.push(items[i].shortDesc), sc++;
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
            result.push(this.shortDesc || 'Some Unknown Location');
            result.push(this.longDesc || 'Some nondescript location without so much as a single, notable feature');
            let exits = this.onGetObviousExits(perspective);
            if (exits) result.push(this.onGetObviousExits(perspective));
            result.push(this.onGetContentDescription(perspective));
            return result.join('\n');
        }
    }

    onGetObviousExits(perspective) {
        let exits = get('exits', []);
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

    /**
     * 
     * @param {Object.<string,string|{dest:string,props:object}>} exitSpec
     */
    setExits(exitSpec) {
        typeof exitSpec === 'object' && Object.keys(exitSpec)
            .forEach(exit => {
                let val = exitSpec[exit];
                if (typeof val === 'string')
                    this.addExit(exit, val);
                else if (typeof val === 'object' && typeof val.dest === 'string')
                    this.addExit(exit, val.dest, val);
            });
        return this;
    }
}

module.addMixin(Room, 'Partials/Senses');

module.exports = Room;
