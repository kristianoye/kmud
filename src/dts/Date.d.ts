interface Date {
    /**
     * Add a set number of ms to a Date and return
     * @param ms
     */
    addMs(ms: number): Date;

    addSeconds(seconds: number): Date;

    addMinutes(minutes: number): Date;

    addHours(hours: number): Date;

    addDays(days: number): Date;
}
