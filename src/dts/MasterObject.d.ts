
declare class MasterObject extends MUDObject {
    validRead(reader: string, target: string, method: string): boolean;
    validRead(reader: MUDObject, target: string, method: string): boolean;
}