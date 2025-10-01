/// <reference lib="es2020" />
/// <reference lib="esnext.asynciterable" />
/// <reference lib="esnext.intl" />
/// <reference lib="esnext.bigint" />

/// <reference path="execution.d.ts"/>
/// <reference path="mudobject.d.ts"/>
/// <reference path="efuns.d.ts"/>
/// <reference path="filesystem.d.ts"/>
/// <reference path="driver.d.ts" />
/// <reference path="global.d.ts" />


/** The global game driver instance  */
declare var driver: IGameServer;

/** Driver's instance of efuns are available in driver source */
declare var efuns: IEFUNProxy;

/** Macro for the line number in a source file */
declare var __line: number;
