
## Driver:
1. Virtual Objects: Do not re-compile parent module for every load;
1. Virtual Objects: Use module base directory to resolve includes and imports (not virtual directory).
1. MUDStorage: Add backreference notation to prevent circular encoding.
1. MUDCompiler: freeze prototype chains after compiling.

### Nice to have:
1. Redirect HTTP clients to HTTP ports when connecting to Telnet port.

## Mudlib:
