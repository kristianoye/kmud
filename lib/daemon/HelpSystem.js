/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class HelpCategory {
    /**
     * Create a new help category.
     * @param {string} cat The name of the category
     * @param {HelpCategory} parent The parent category (if any)
     * @param {string[]} cats Child category expression.
     */
    constructor(cat, parent, cats) {
        this.category = cat;
        this.normalized = cat.replace(/\s+/g, '').toLowerCase();

        /** @type {Object.<string,HelpCategory>} */
        this.categories = {};

        this.parent = parent;

        /** @type {Object.<string,MUDHelp>} */
        this.topics = {};

        /** @type {string} */
        this.type = 'category';

        let foo = cat.toLowerCase();
        if (foo.startsWith('admin ')) {
            this.validAccess = (user) => efuns.adminp(user);
        }
        else if (foo.startsWith('arch ')) {
            this.validAccess = (user) => efuns.archp(user);
        }
        else if (foo.startsWith('creator') || foo.startsWith('wizard')) {
            this.validAccess = (user) => efuns.wizardp(user);
        }
        else
            this.validAccess = (user) => true;

        if (cats && cats.length) {
            let child = cats.shift();
            this.categories[child] = new HelpCategory(child, this, cats);
        }
        let path = [], node = this;
        while (node) {
            path.unshift(node.category);
            node = node.parent;
        }
        this.path = path.join(':');
    }

    /**
     * Add a topic to the category.
     * @param {string} topic
     * @param {MUDHelp} help
     */
    addTopic(topic, help) {
        this.topics[topic] = help;
        return this;
    }

    /**
     * Check to see if the given string matches the catory name
     * @param {string} cat
     */
    equals(cat) {
        return cat && cat.replace(/\s+/g, '').toLowerCase() == this.normalized;
    }

    /**
     * Helps resolve a specific category. 
     * @param {string[]} cats
     * @param {boolean=} create Create if missing?
     * @returns {HelpCategory}
     */
    getCategory(cats, create) {
        let cat = cats.length > 0 ? cats.shift() : false;
        if (thisPlayer && !this.validAccess(thisPlayer))
            return false;
        if (!cat)
            return this;
        else if (cat in this.categories)
            return this.categories[cat].getCategory(cats, create);
        else if (create) {
            let req = cats.slice(0);
            return (this.categories[cat] = new HelpCategory(cat, this, cats))
                .getCategory(req, create);
        }
        else
            return false;
    }

    resolve(topic, category) {
        let result = [];
        if (thisPlayer && this.validAccess(thisPlayer)) {
            if (this.equals(category)) {
                let entry = topic ? this.topics[topic] : this;
                if (entry) result.push(entry);
            }
            else if (!category) {
                let entry = topic ? this.topics[topic] : false;
                if (entry) result.push(entry)
            }
            if (this.equals(topic)) {
                result.push(this);
            }
            Object.keys(this.categories).forEach(c => {
                result.push(...this.categories[c].resolve(topic, category));
            });
        }
        return result;
    }
}

class HelpSystem extends MUDObject {
    create() {
        /** @type {Object.<string,HelpCategory>} */
        this.categories.Index = this.getCategory('Index', true);
    }

    protected get categories() {
        return get({});
    }

    /**
     * Resolve a category
     * @param {string|string[]} name
     * @param {boolean} create Create if missing?
     */
    getCategory(name, create) {
        let cats = Array.isArray(name) ?
            name : name.split('>').map(s => s.trim()),
            topCat = cats.shift();

        if (topCat !== 'Index') {
            cats.unshift(topCat);
            topCat = 'Index';
        }
        if (topCat in this.categories) {
            return this.categories[topCat].getCategory(cats, create);
        }
        else if (create) {
            let req = cats.slice(0),
                cat = this.categories[topCat] = new HelpCategory(topCat, false, cats);
            return cat.getCategory(req);
        }
        return false;
    }

    /**
     * Added by command resolver to ensure help system has the specified
     * command in its cache.
     * @param {Command} cmdRef The command to add.
     * @param {string} verb The verb used to invoke the command.
     */
    addCommand(cmdRef, verb) {
        if (cmdRef) {
            let help = cmdRef().getHelp();
            if (typeof help === 'object') {
                if (!help.type)
                    help.type = 'command';
                if (!help.command)
                    help.command = verb;
                let category = this.getCategory(help.category, true);

                if (!category)
                    throw new Error(`Category '${help.category || '(not specified)'}' not found!`);

                category.addTopic(help.command, this.prepHelp(help));
            }
        }
    }

    /**
     * Cleans up/normalizes MUD help object a bit.
     * @param {MUDHelp} help
     * @returns {MUDHelp}
     */
    prepHelp(help) {
        if (!help.description)
            help.description = '<p>No help text available.</p>';
        else {
            let lines = help.description.split('\n').map(s => s.trim())
            help.description = lines.join('\n') + '\n';
        }
        if (!help.seeAlso)
            help.seeAlso = [];
        return help;
    }

    getHelp(topic, category) {
        if (topic && topic.toLowerCase() === 'index')
            return [this.categories.Index];
        else if (!topic && !category)
            return this.categories.Index;
        else {
            let results = this.categories['Index'].resolve(topic, category);
            return results;
        }
    }
}

module.exports = new HelpSystem();
