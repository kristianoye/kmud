MUD.include('Base');

MUD.imports(LIB_VERB);

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
        if (!thisPlayer.environment)
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
        thisPlayer.writeLine(thisPlayer.environment.onGetDescription(thisPlayer));
        return true;
    }

    doLookAtObject(target) {
        thisPlayer.writeLine('You look at the {0}'.fs(target.shortDescription));
        thisPlayer.writeLine(target.longDescription);
        return true;
    }

    doLookAtObjectInObject(target, container) {
        thisPlayer.writeLine('You look at the {0} in {1}'.fs(target.shortDescription, container.shortDescription));
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
        var str = thisPlayer.environment.getItem(str);
        return str;
    }

    doLookIntoObject(target) {
        return true;
    }

    doLookThroughString(str) {
        return true;
    }
}

MUD.export(Look);
