# Filesystem Architecture

The KMUD filesystem has a traditional procedural API but is designed to be object-oriented.  The file subsystem consists of the following pieces

* EFUN Object (External Functions)
	> The filesystem is exposed to the MUDlib through the use of the File API.  These methods are the only method by which to communicate with the File Manager

* The File Manager
	> The File Manager object brokers requests between the MUDlib and the underlying storage engine.

* The Security Manager
	> The security manager is created by the File Manager at startup and performs accecss checks on every file system request.

* Filesystem Object
	> Each mounted filesystem is managed by a Filesystem object.  The underlying storage system may be a physical disk, a database, etc.

* File Objects and Wrappers
	> Each object on a particular filesystem is represented by an object.  The driver gets unfettered access to the internals, but the MUDlib receives a wrapped version of these objects to ensure that security is enforced.
