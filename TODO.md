﻿
## Driver:
1. Virtual Objects: Do not re-compile parent module for every load;
1. Virtual Objects: Use module base directory to resolve includes and imports (not virtual directory).
1. MUDStorage: Add backreference notation to prevent circular encoding.
1. MUDScript: Call ExecutionContext.validSyncCall at runtime for unawaited method calls to ensure no broken promises

### Nice to have:
1. Redirect HTTP clients to HTTP ports when connecting to Telnet port.
1. Add support for virtual Diku/Circle areas https://www.circlemud.org/cdp/building/building.html

## Mudlib:
1. Finish command shell applies
2. Make move* applies async
