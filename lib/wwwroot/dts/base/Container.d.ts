

interface Container extends GameObject {

    canAcceptItem(ob: GameObject): boolean;

    canReleaseItem(ob: GameObject): boolean;

    /** Returns the mass of an object in grams */
    getWeight(): number;
}

/// <reference path="GameObject.d.ts"/>