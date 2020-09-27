declare interface String {
    /**
     * Check to see if the string contains a particular substring.
     * @param substring The substring to search for
     * @param ignoreCase Ignore case if set to true
     */
    contains(substring: string, ignoreCase?: boolean): boolean;

    /**
     * Count the number of instances of a particular substring.
     * @param substring
     * @param ignoreCase
     */
    countInstances(substring: string, ignoreCase?: boolean): number;

    /**
     * Use this string as a formatting string ala .NET Format()
     * @param args
     */
    fs(...args: any[]): string;

    /** Return the string with the first letter being upper-cased */
    ucfirst(): string;
}
