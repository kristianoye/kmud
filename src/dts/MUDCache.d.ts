/// <reference path="./MUDModule.d.ts"/>

declare class MUDCache {
    /**
     * Deletes a module from the cache.
     * @param filename The path to the module to delete.
     */
    delete(filename: string): boolean;

    /**
     * Gets an existing module or returns false.
     * @param filename
     */
    get(filename: string): MUDModule | false;

    /**
     * Gets an existing module or creates an entry if not.
     * @param filename
     */
    getOrCreate(filename: string): MUDModule | false;

    /**
     * 
     * @param filename
     * @param dataType
     */
    getType(filename: string, dataType: string): MUDModule;

    /**
     * Attempt to resolve a module.
     * @param modulePath The module to try and resolve.
     */
    resolve(modulePath: string): MUDModule | false;
}
