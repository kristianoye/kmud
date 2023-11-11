/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Verb = await requireAsync(Base.Verb);

class Look extends Verb {
    create() {
        this
            .setVerb("look")
            .addRules(
            "",
            "at OBJECT",
            "at STRING",
            "at STRING on OBJECT",
            "into OBJECT",
            "through STRING",
            "at OBJECT in OBJECT",
            "at OBJECT on OBJECT",
            "at OBJECT through OBJECT");
    }

    canLook() {
        if (!thisPlayer().environment)
            return "You appear to be in the void!";
        return true;
    }

    canLookAtObject(target) {
        return this.canLook();
    }


    canLookAtObjectInObject(target, container) {
        return this.canLook();
    }

    canLookAtObjectOnObject(target, container) {
        return this.canLook();
    }

    canLookAtObjectThroughObject(target, container) {
        return this.canLook();
    }

    canLookAtStringOnObject(target, container) {
        return this.canLook();
    }

    canLookAtString(target) {
        let item = thisPlayer().environment.getItem(target);

        if (!item)
            return `You do not appear to see ${target}.`;
        else if (!item.description)
            return `The ${target} cannot be looked at.`;

        return this.canLook();
    }

    canLookIntoObject(target) {
        return this.canLook();
    }

    canLookThroughString(str) {
        let item = thisPlayer().environment.getItem(str);

        if (!item)
            return `You do not appear to see ${str}.`;
        else if (!item.description)
            return `The ${str} cannot be looked through.`;
        return this.canLook();
    }

    doLook() {
        let player = thisPlayer();
        let env = player.environment;
        if (!env)
            return writeLine('You appear to be in the void!');
        else
            return writeLine(env.onGetDescription(player));
    }

    doLookAtObject(target) {
        writeLine(`You look at ${target.shortDesc}`);
        writeLine(target.longDesc);
        return true;
    }

    doLookAtObjectInObject(target, container) {
        writeLine(`You look at the ${target.shortDesc} in ${container.shortDesc}`);
        return true;
    }

    doLookAtObjectOnObject(target, container) {
        return true;
    }

    doLookAtObjectThroughObject(target, container) {
        return true;
    }

    doLookAtStringOnObject(target, container) {
        return true;
    }

    doLookAtString(str) {
        let item = thisPlayer().environment.getItem(str);

        if (typeof item.description === 'function') {
            let result = item.description(str);
            if (typeof result === 'string')
                return writeLine(result);
            else
                return true;
        }
        else if (typeof item.description === 'string') {
            return writeLine(item.description);
        }
        return str;
    }

    doLookIntoObject(target) {
        return true;
    }

    doLookThroughString(str) {
        return true;
    }
}

module.exports = await createAsync(Look);
