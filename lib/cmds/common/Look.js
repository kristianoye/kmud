/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Verb = require(Base.Verb);

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
        return true;
    }


    canLookAtObjectInObject(target, container) {
        return true;
    }

    canLookAtObjectOnObject(target, container) {
        return true;
    }

    canLookAtObjectThroughObject(target, container) {
        return true;
    }

    canLookAtStringOnObject(target, container) {
        return true;
    }

    canLookAtString(target) {
        return true;
    }

    canLookIntoObject(target) {
        return true;
    }

    canLookThroughString(str) {
        return true;
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
        let itemDesc = thisPlayer().environment.getItem(str);
        return str;
    }

    doLookIntoObject(target) {
        return true;
    }

    doLookThroughString(str) {
        return true;
    }
}

module.exports = new Look();
