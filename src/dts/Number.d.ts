
interface Number {
    /**
     * Clears the specified bit flag
     * @param flag
     */
    clearFlag(flag: number): Number;

    /**
     * Returns true if one or more of the specified bits are set.
     * @param flags
     */
    hasAnyFlag(flags: number): boolean;

    /**
     * Treat this number like a bit array to see if a particular bit is set.
     * @param flag The bit to test for
     * @returns True if the particular flag or flags are set.
     */
    hasFlag(flag: number): boolean;

    /**
     * Sets the specified bit flag
     * @param flag The flag to set
     */
    setFlag(flag: number): Number;
}