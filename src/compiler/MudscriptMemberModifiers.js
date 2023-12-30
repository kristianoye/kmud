/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Bitflags used by MudScript language to modify class-related declarations
 */

const
    Public = 1 << 0,
    Protected = 1 << 1,
    Private = 1 << 2,
    Package = 1 << 3,
    Abstract = 1 << 4,
    Final = 1 << 5,
    Override = 1 << 6,
    Singleton = 1 << 7,
    NoSave = 1 << 8,
    Static = 1 << 9,
    Async = 1 << 10,
    Origin = 1 << 11,

    ValidAccess = Public | Protected | Private | Package,
    ValidDefaultAccess = Public | Protected | Private | Package | Final,

    HasAnyFlags = (current, flags) => {
        return (current & flags) !== 0;
    },

    HasFlags = (current, flags) => {
        return (current & flags) === flags;
    };

const MudscriptMemberModifiers = {
    Public,
    Protected,
    Private,
    Package,
    Abstract,
    Final,
    Override,
    Singleton,
    NoSave,
    Static,
    Async,
    Origin,

    //  The constructor name
    ConstructorName: 'create',

    ValidAccess,

    //  Mask to check default visibility for class members
    ValidDefaultAccess,

    HasFlags,

    HasAnyFlags,

    ParseMemberAccess: (spec) => {
        let result = 0;

        if (typeof spec === 'number') {
            if ((spec & ~ValidDefaultAccess) !== 0)
                throw new Error(`Specified default member access mask (${spec}) is invalid`);
            result = spec;
        }
        else if (typeof spec === 'string') {
            let parts = spec.split('|')
                .map(s => s.trim().toLowerCase())
                .filter(s => s.length > 0);

            if (parts.length === 0)
                throw new Error(`Invalid default member access specifier (${spec}); String is invalid`);

            parts.forEach(s => {
                switch (s) {
                    case 'final': return result |= Final;
                    case 'package': return result |= Package;
                    case 'private': return result |= Private;
                    case 'protected': return result |= Protected;
                    case 'public': return result |= Public;
                    default: throw new Error(`Part of the default member access specifier (${s}) is invalid`);
                }
            });
        }
        else
            throw new Error(`Default member access specifier must be a string or a number, not ${(typeof spec)}`);

        if ((result & Public) > 0) {
            if (HasAnyFlags(result, Private | Package | Protected))
                throw new Error('Default member access cannot combine both public with private, package, or protected modifiers');
        }
        else if ((result & MemberModifiers.Private) > 0) {
            if (HasAnyFlags(result, Package | Protected))
                throw new Error('Default member access cannot combine both private with package or protected modifiers');
        }
        return result;
    }
};

module.exports = MudscriptMemberModifiers;
