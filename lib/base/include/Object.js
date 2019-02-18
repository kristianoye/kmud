/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2017
 */
module.exports = Object.freeze({
    //  A list of adjectives associated with an object (man is 'lazy', 'old', 'tired', etc)
    PROP_ADJECTIVES: 'object/adjectives',

    //  Synonym for keyID
    PROP_NAME: 'object/keyId',

    //  The long description
    PROP_DESCRIPTION: 'object/description',

    //  A short description is one, descriptive line of text
    PROP_SHORTDESC: 'object/brief',

    //  An id list is a list of single pronouns associated with the object (man, woman, wolf, etc)
    PROP_IDLIST: 'object/idList',

    //  The key ID is the primary identifier or name associated with an object (bob)
    PROP_KEYID: 'keyId',

    //  Contains a list of non-standard identifiers used to identify a group of similar objects (gabble of geese)
    PROP_PLURALS: 'object/pluralIdentifiers',

    //  The weight of an object
    PROP_WEIGHT: 'object/weight'
});
