class EmoteDaemon extends MUDObject {

    /**
     * Add an adverb
     * @param {...string[]} adverbs
     */
    addAdverbs(...adverbs) {
        let added = 0;
        adverbs.forEach((adverb) => {
            let index = this.adverbs.indexOf(adverb)
            if (index === -1) {
                this.adverbs.push(adverb);
                added++;
            }
        });
        if (added > 0) this.save();
        return this;
    }

    /**
     * Add an emote rule
     * @param {string} verb
     * @param {...string[]} rules
     */
    addEmoteRule(verb, ...rules) {
        let updates = 0, newEntry = false,
            entry = this.emotes[verb] || (newEntry = true, []);
        rules.forEach((rule) => {
            if (entry.indexOf(rule) === -1) {
                updates++;
                entry.push(rule);
            }
        });

        if (newEntry) this.emotes[verb] = entry;
        if (updates > 0) this.save();
        return this;
    }

    /**
     * @returns {string[]}
     */
    get adverbs() {
        return this.getProperty('adverbs', []);
    }

    set adverbs(list) {
        this.setProperty('adverbs', list);
    }

    /**
     * Load emotes from the save file.
     * Examples:
     *    laugh [ "", "at LIV", "WRD at LIV", "at OBJ", "WRD at OBJ", "OBJ in OBJ", "WRD OBJ in OBJ" ]
     */
    create() {
        /** @type {string[]} */
        this.adverbs = [];

        /** @type {Object.<string,string[]>} */
        this.emotes = {};
        efuns.restoreObject(__dirname + '/save/EmoteDaemon.json');
    }

    /**
     * Attempt to perform an emote.
     * @param {string} verb The emote verb.
     * @param {string[]} args Additional parameters for the emote.
     */
    cmd(verb, args) {
        let entry = this.emotes[verb];
        if (entry) {
            for (let i = 0; i < entry.length; i++) {
                if (entry[i].length === 0 && args.length === 0) {
                    this.performEmote(verb);
                    break;
                }
            }
        }
        return false;
    }

    /**
     * @returns {Object.<string,string[]>}
     */
    get emotes() {
        return this.getProperty('emotes', {});
    }

    set emotes(data) {
        if (typeof data !== 'object') return;
        return this.setProperty('emotes', data);
    }

    getAdverbs(filter) {
        return filter ? this.adverbs.filter(a => a.match(filter)) : this.adverbs;
    }

    getEmotes(filter) {
        let result = [];
        Object.keys(this.emotes)
            .filter(verb => filter ? verb.match(filter) : true)
            .forEach((verb) => {
                result.push(verb);
                this.emotes[verb].forEach((rule) => {
                    result.push(`\t${verb} ${rule}`);
                });
            });
        return result;
    }

    save() {
        efuns.saveObject(__dirname + '/save/EmoteDaemon.json')
    }
}

module.exports = EmoteDaemon;

