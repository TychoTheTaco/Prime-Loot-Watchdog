import {JourneyInfo} from "../watchdog.js";

export abstract class Notifier {

    abstract onUpdate(offers: JourneyInfo[]): void;

}
