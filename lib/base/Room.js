MUD.imports('Container');

class Room extends Container {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.prop({
            exits: {},
            light: 0,
            elevation: 0
        }));
    }

    /**
        * Add an exit to the room
        * @param {string} dir The direction in which to travel.
        * @param {string} dest The destination if the player moves in this direction.
        */
    addExit(dir, dest, hidden) {
        var exits = this.getProperty('exits');
        exits[dir] = {
            destination: dest,
            hidden: hidden === true
        };
        return this;
    }

    canAcceptItem(item) {
        return true;
    }

    getExit(dir) {
        var exits = this.getProperty('exits');
        var exit = exits[dir] || false;
        if (exit) {
            var dest = exit.destination;
            if (typeof dest === 'function')
                dest = dest.call(this, thisPlayer);
            return dest;
        }
        return false;
    }

    get indoors() {
        var prop = this.getProperty('indoors', false);
        return prop;
    }

    get light() {
        var prop = this.getProperty('light', 0);
        return prop;
    }

    hasExit(dir) {
        var exits = this.getProperty('exits');
        return !!exits[dir];
    }

    onGetContentDescription(perspective) {
        var items = this.inventory
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
            result.push(this.shortDescription);
            result.push(this.longDescription);
            result.push(this.onGetObviousExits(perspective));
            result.push(this.onGetContentDescription(perspective));
            return result.join('\n');
        }
    }

    onGetObviousExits(perspective) {
        var exits = this.getProperty('exits');
        var result = [];

        for (var dir in exits) {
            var exit = exits[dir];
            if (exit.hidden) continue;
            result.push(dir);
        }
        if (result.length === 0)
            return "There are no obvious exits.";
        else
            return "There {0} {1} obvious {2}: {3}".fs(
                result.length > 1 ? "are" : "is",
                efuns.cardinal(result.length),
                result.length > 1 ? "exits" : "exit",
                (function () {
                    if (result.length === 1)
                        return result[0];
                    else if (result.length === 2)
                        return result[0] + ' and ' + result[1];
                    else
                        return result.slice(0, result.length - 1).join(', ')
                            + ' and ' + result.slice(result.length);
                })());
    }

    setLight(level) {
        return this.setProperty('light', level);
    }
}

loadPartial(Room, 'Partials/Senses');

MUD.export(Room);
