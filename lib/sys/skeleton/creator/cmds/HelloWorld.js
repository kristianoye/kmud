
import { LIB_COMMAND } from '@Base';
import { Command } from LIB_COMMAND;

class HelloWorld extends Command {
    cmd() {
        return writeLine('Hello World');
    }
}