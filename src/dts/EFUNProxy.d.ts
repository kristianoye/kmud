/// <reference path="GameServer.d.ts"/>

/**
 * Provides an API that may be used by every object in the game.
 */
declare class EFUNProxy {
    createPassword(plain: string): string;
    createPassword(plain: string, callback: (enc: string) => void): void;
    currentVerb(): string;
    deepInventory(target: MUDObject): MUDObject[];
    deepInventory(target: MUDObject, callback: (inv: MUDObject[]) => void): void;
    driver: GameServer;
    exec(oldBody: MUDObject, newBody: MUDObject): boolean;
    exec(oldBody: MUDObject, newBody: MUDObject, callback: (oldBody: MUDObject, newBody: MUDObject) => void): boolean;
    featureEnabled(name: string): boolean;
}