/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Container = await requireAsync(Base.Container);

class Room extends Container {
    protected constructor() {
        super();

        this.exits = {};
        this.light = 0;
        this.indoors = false;
        this.elevation = 0;
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

    /**
     * Add a plain item to the room
     * @param {string} item The item to describe
     * @param {{ smell: string|function(string), taste:string|function(string), listen:string|function(string), feeling:string|function(string), description:string|function(string) }} data
     */
    addItem(item, data) {
        let [keyName, props, validCount] = this.validItem(item, data);
        if (validCount > 0) {
            let items = this.items;
            items[keyName] = props;
        }
        return this;
    }

    canAcceptItem(item) {
        return true;
    }

    get elevation() { return get(0); }

    set elevation(value) {
        if (typeof value === 'number')
            set(value);
    }

    get exits() {
        return get({});
    }

    protected set exits(value) {
        if (typeof value === 'object')
            return set(value);
    }

    getExit(dir) {
        let exits = this.exits,
            exit = exits[dir] || false;

        if (exit) {
            let dest = exit.destination;
            if (typeof dest === 'function')
                dest = dest(thisPlayer);
            return dest;
        }
        return false;
    }

    getItem(key) {
        let items = this.items;
        if (key in items) {
            return items[key];
        }
        return undefined;
    }

    get indoors() {
        return get('room/indoors', false) === true;
    }

    set indoors(value) {
        if (typeof value === 'boolean') {
            set(value);
        }
    }

    get items() {
        return get({});
    }

    set items(data) {
        if (typeof data === 'object') {
            const validAttributes = ['smell', 'taste', 'listen', 'feeling', 'description'];
            let valid = {};

            for (const [key, val] of Object.entries(data)) {
                let [keyName, props, validCount] = this.validItem(key, val);

                if (validCount > 0) {
                    valid[keyName] = props;
                }
            }

            set(valid);
        }
    }

    get light() {
        return get(0);
    }

    set light(value) {
        if (typeof value === 'number')
            set(value);
    }

    hasExit(dir) {
        let exits = this.exits;
        return typeof dir === 'string' && dir in exits;
    }

    onGetContentDescription(perspective) {
        //  Do not display the observer in the collection.
        let items = this.inventory.filter(i => i !== perspective),
            shorts = [], sc = 0,
            livings = [], lc = 0,
            players = [],
            result = [];

        for (let i = 0, max = items.length; i < max; i++) {

            if (efuns.playerp(items[i])) {
                if (efuns.adminp(items[i])) 
                    players.push('%^MAGENTA%^%^BOLD%^[ADMIN] ' + items[i].getTitle() + ' is here.%^RESET%^');

                else if (efuns.archp(items[i]))
                    players.push('%^CYAN%^%^BOLD%^[ARCH] ' + items[i].getTitle() + ' is here.%^RESET%^');

                else if (efuns.wizardp(items[i]))
                    players.push('%^GREEN%^%^BOLD%^[WIZARD] ' + items[i].getTitle() + ' is here.%^RESET%^');

                else
                    players.push('%^RED%^%^BOLD%^[PLAYER] ' + items[i].getTitle() + ' is here.%^RESET%^');
            }
            else if (efuns.living.isAlive(items[i]))
                livings.push('[NPC] ' + items[i].shortDesc), lc++;
            else
                shorts.push(items[i].shortDesc), sc++;
        }

        if (players.length > 0)
            result.push(...players);

        if (livings.length > 0)
            result.push('%^RED%^' + efuns.arrayToSentence(livings).ucfirst() + (lc > 1 ? " are here." : " is here.") + '%^RESET%^');

        if (shorts.length > 0)
            result.push(efuns.arrayToSentence(shorts).ucfirst() + (sc > 1 ? " are here." : " is here."));

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
            return result.join(efuns.eol);
        }
    }

    onGetObviousExits(perspective) {
        let exits = this.exits;
        let result = [];
        let text = '';

        Object.getOwnPropertyNames(exits).forEach(dir => {
            let exit = exits[dir];
            if (exit.hidden !== true) {
                result.push(dir);
            }
        });

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

    protected validItem(key, val) {
        const validAttributes = ['smell', 'taste', 'listen', 'feeling', 'description'];

        if (typeof val !== 'object' || typeof key !== 'string')
            return [key, {}, 0];

        let validKeys = 0, props = {};

        for (const att of validAttributes) {
            if (att in val) {
                props[att] = val[att];
                validKeys++;
            }
        }
        return [key, props, validKeys];
    }
}

module.exports = Room;
